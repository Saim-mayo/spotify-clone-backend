const mongoose = require('mongoose');

const musicModel = require('../models/music.model');
const albumModel = require('../models/album.model');
const LikeModel = require('../models/like.model');
const HistoryModel = require('../models/history.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const { uploadFile } = require('./storage.service');

/**
 * =====================================
 * 🎵 CREATE SONG SERVICE
 * =====================================
 * WHY SAFE:
 * - prevents empty title crash
 * - prevents multer missing file crash
 * - prevents ImageKit upload crash
 */
const createSongService = async ({ title, file, userId }) => {

   // ❌ WHY: empty string would create invalid DB record
   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   // ❌ WHY: multer failure OR wrong form-data key = file undefined
   if (!file || !file.buffer) {
      throw new AppError('Valid audio file is required', 400);
   }

   // ❌ WHY: upload APIs often fail if raw buffer is passed incorrectly
   const base64 = file.buffer.toString('base64');

   const result = await uploadFile(base64, file.originalname);

   // ❌ WHY: avoid silent failure if storage service fails
   if (!result || !result.url) {
      throw new AppError('File upload failed', 500);
   }

   return await musicModel.create({
      uri: result.url,
      title: title.trim(),
      artist: userId
   });
};


/**
 * =====================================
 * ▶ PLAY SONG SERVICE
 * =====================================
 * WHY:
 * - validates Mongo ID before DB query
 * - prevents invalid ID crash
 */
const playSongService = async ({ songId, userId }) => {

   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid song id', 400);
   }

   const song = await musicModel.findByIdAndUpdate(
      songId,
      { $inc: { playCount: 1 } },
      { new: true }
   );

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   await HistoryModel.create({
      user: userId,
      song: songId
   });

   return song;
};


/**
 * =====================================
 * 🔍 SEARCH SONGS
 * =====================================
 * WHY FIXED:
 * - prevents empty query crash
 * - trims input to avoid useless DB scan
 */
const searchSongsService = async (q) => {

   if (!q || q.trim() === '') {
      throw new AppError('Search query is required', 400);
   }

   return await musicModel
      .find({
         title: { $regex: q.trim(), $options: 'i' }
      })
      .populate('artist', 'username avatar')
      .limit(20)
      .lean();
};


/**
 * =====================================
 * 👤 SEARCH ARTISTS
 * =====================================
 */
const searchArtistsService = async (q) => {

   if (!q || q.trim() === '') {
      throw new AppError('Search query is required', 400);
   }

   return await userModel.find({
      username: { $regex: q.trim(), $options: 'i' },
      role: 'artist'
   })
   .select('username avatar bio')
   .limit(20)
   .lean();
};


/**
 * =====================================
 * 💿 CREATE ALBUM
 * =====================================
 * WHY FIXED:
 * - ensures musics is array (prevents schema crash)
 */
const createAlbumService = async ({ title, musics, userId }) => {

   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   if (!Array.isArray(musics)) {
      throw new AppError('Musics must be an array', 400);
   }

   return await albumModel.create({
      title: title.trim(),
      artist: userId,
      musics
   });
};


/**
 * =====================================
 * 📀 GET ALL SONGS
 * =====================================
 * WHY:
 * - pagination safety (string → number fix)
 */
const getAllSongsService = async ({ page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   const [songs, total] = await Promise.all([
      musicModel
         .find()
         .populate('artist', 'username email role')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      musicModel.countDocuments()
   ]);

   return {
      songs,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};


/**
 * =====================================
 * 🔥 TRENDING SONGS
 * =====================================
 * NOTE:
 * - currently only sorted by playCount
 * - can later improve using likes + time decay
 */
const getTrendingSongsService = async () => {

   return await musicModel
      .find()
      .sort({ playCount: -1 })
      .limit(20)
      .populate('artist', 'username')
      .lean();
};


/**
 * =====================================
 * 📜 USER HISTORY
 * =====================================
 */
const getUserHistoryService = async (userId) => {

   return await HistoryModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('song', 'title uri artist');
};


/**
 * =====================================
 * EXPORTS
 * =====================================
 */
module.exports = {
   createSongService,
   playSongService,
   searchSongsService,
   searchArtistsService,
   createAlbumService,
   getAllSongsService,
   getTrendingSongsService,
   getUserHistoryService
};