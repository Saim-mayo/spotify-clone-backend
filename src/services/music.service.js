const mongoose = require('mongoose');

const musicModel = require('../models/music.model');
const albumModel = require('../models/album.model');
const HistoryModel = require('../models/history.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const { uploadFile } = require('./storage.service');
// =====================================
// 🎵 LOAD ACTIVE SONG
// =====================================
const getSongById = async (songId) => {

   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid song id', 400);
   }

   const song = await musicModel
      .findOne({
         _id: songId,
         deletedAt: null,
         status: 'active'
      });

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   return song;
};
// =====================================
// 🔒 ESCAPE REGEX (PREVENT ReDoS)
// =====================================
const escapeRegex = (text) => {
   return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// =====================================
// 🎵 CREATE SONG SERVICE
// =====================================
const createSongService = async ({ title, file, userId }) => {

   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   if (!file || !file.buffer) {
      throw new AppError('Valid audio file is required', 400);
   }

   // Pass the raw Buffer.
   const result = await uploadFile(
      file.buffer,
      file.originalname 
   );

   if (!result || !result.filePath) {
      throw new AppError('File upload failed', 500);
   }

   return await musicModel.create({
      fileId: result.fileId,
      filePath: result.filePath,
      title: title.trim(),
      artist: userId,

      status: 'active',
      visibility: 'public',
      premiumOnly: false,
      allowDownload: true,
      processingFinished: true
   });
};

// =====================================
// ▶ PLAY SONG SERVICE
// =====================================
const playSongService = async ({ songId, userId }) => {

   const song = await getSongById(songId);

   song.playCount += 1;
   await song.save();

   await HistoryModel.create({
      user: userId,
      song: song._id
   });

   return song;
};

// =====================================
// 🔍 SEARCH SONGS (SECURE)
// =====================================
const searchSongsService = async (q) => {

   if (!q || q.trim() === '') {
      throw new AppError('Search query is required', 400);
   }

   // 🔒 Prevent regex injection
   const safeQuery = escapeRegex(q.trim());

   return await musicModel
      .find({
         title: { $regex: safeQuery, $options: 'i' },
         status: 'active',
         deletedAt: null,
         visibility: 'public'
      })
      .populate('artist', 'username avatar') // ✅ NO EMAIL
      .limit(20)
      .lean();
};

// =====================================
// 👤 SEARCH ARTISTS (SECURE)
// =====================================
const searchArtistsService = async (q) => {

   if (!q || q.trim() === '') {
      throw new AppError('Search query is required', 400);
   }

   const safeQuery = escapeRegex(q.trim());

   return await userModel.find({
      username: { $regex: safeQuery, $options: 'i' },
      role: 'artist'
   })
      .select('username avatar bio')
      .limit(20)
      .lean();
};

// =====================================
// 💿 CREATE ALBUM
// =====================================
const createAlbumService = async ({ title, musics, userId }) => {

   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   if (!Array.isArray(musics)) {
      throw new AppError('Musics must be an array', 400);
   }

   if (musics.length === 0) {
      throw new AppError('Album must contain at least one song', 400);
   }

   const songs = await musicModel.find({
      _id: { $in: musics }
   });

   if (songs.length !== musics.length) {
      throw new AppError('One or more songs not found', 404);
   }

   const foreignSong = songs.find(
      song => song.artist.toString() !== userId.toString()
   );

   if (foreignSong) {
      throw new AppError(
         'You can only add your own songs to an album',
         403
      );
   }

   return await albumModel.create({
      title: title.trim(),
      artist: userId,
      musics
   });
};

// =====================================
// 📀 GET ALL SONGS (FIXED WITH FILTER)
// =====================================
const getAllSongsService = async ({ page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   // === FIX START: Applied exact matching criteria filter to both find and count operations ===
   const filter = {
      status: 'active',
      deletedAt: null,
      visibility: 'public'
   };

   const [songs, total] = await Promise.all([
      musicModel
         .find(filter)
         .populate('artist', 'username avatar') 
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      musicModel.countDocuments(filter) // ← FIX: counts ONLY matching active songs
   ]);
   // === FIX END ===

   return {
      songs,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};

// =====================================
// 📀 GET ALL ALBUMS (FIXED WITH FILTER)
// =====================================
const getAllAlbumsService = async ({ page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   // === FIX START: Applied exact matching criteria filter to both find and count operations ===
   const filter = {
      status: 'active',
      deletedAt: null
   };

   const [albums, total] = await Promise.all([
      albumModel
         .find(filter)
         .populate('artist', 'username avatar')
         .populate('musics', 'title ')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      albumModel.countDocuments(filter) // ← FIX: counts ONLY matching active albums
   ]);
   // === FIX END ===

   return {
      albums,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};
// =====================================
// 📀 GET ALBUM BY ID
// =====================================
const getAlbumByIdService = async (albumId) => {

   if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw new AppError('Invalid albumId', 400);
   }

   const album = await albumModel.findById(albumId)
      .populate('artist', 'username avatar')
      .populate('musics', 'title  playCount');

   if (!album) {
      throw new AppError('Album not found', 404);
   }

   return album;
};

// =====================================
// 🔥 TRENDING SONGS
// =====================================
const getTrendingSongsService = async () => {

   return await musicModel
      .find({
         status: 'active',
         visibility: 'public',
         isDeleted: false,
         deletedAt: null
      })
      .sort({ playCount: -1 })
      .limit(20)
      .populate('artist', 'username')
      .lean();
};

// =====================================
// 📜 USER HISTORY
// =====================================
const getUserHistoryService = async (userId) => {

   return await HistoryModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('song', 'title  artist');
};

// =====================================
// EXPORTS
// =====================================
module.exports = {
   getSongById,
   createSongService,
   playSongService,
   searchSongsService,
   searchArtistsService,
   createAlbumService,
   getAllSongsService,
   getAllAlbumsService,
   getAlbumByIdService,
   getTrendingSongsService,
   getUserHistoryService
};