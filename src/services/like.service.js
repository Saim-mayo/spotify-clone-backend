const mongoose = require('mongoose');

const LikeModel = require('../models/like.model');
const musicModel = require('../models/music.model');
const AppError = require('../utils/appError');

/**
 * =========================================
 * ❤️ LIKE SONG SERVICE
 * =========================================
 */
const likeSongService = async (userId, songId) => {

   // ✅ validate mongo id
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid songId', 400);
   }

   // ✅ ensure song exists
   const song = await musicModel.findById(songId);

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   // ✅ prevent duplicate likes
   const existingLike = await LikeModel.findOne({
      user: userId,
      song: songId
   });

   if (existingLike) {

      // ❌ BEFORE:
      // throw new Error(...)
      // caused INTERNAL SERVER ERROR 500

      // ✅ NOW:
      // clean business logic response
      throw new AppError(
         'You already liked this song',
         409 // conflict
      );
   }

   // ✅ create like safely
   const like = await LikeModel.create({
      user: userId,
      song: songId
   });

   return like;
};


/**
 * =========================================
 * 💔 UNLIKE SONG SERVICE
 * =========================================
 */
const unlikeSongService = async (userId, songId) => {

   // ✅ validate id
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid songId', 400);
   }

   // ✅ ensure song exists
   const songExists = await musicModel.findById(songId);

   if (!songExists) {
      throw new AppError('Song not found', 404);
   }

   // ✅ attempt unlike
   const deleted = await LikeModel.findOneAndDelete({
      user: userId,
      song: songId
   });

   // ✅ prevent fake unlikes
   if (!deleted) {

      // ❌ BEFORE:
      // internal server error

      // ✅ NOW:
      // proper business response
      throw new AppError(
         'Song is not liked yet',
         409
      );
   }

   return true;
};


/**
 * =========================================
 * 📊 GET SONG LIKES SERVICE
 * =========================================
 */
const getSongLikesService = async (songId) => {

   // ✅ validate MongoDB id
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid songId', 400);
   }

   // ✅ ensure song exists (important for clean API behavior)
   const song = await musicModel.findById(songId).lean();

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   // ✅ count likes
   const totalLikes = await LikeModel.countDocuments({
      song: songId
   });

   return {
      songId,
      totalLikes,
      hasLikes: totalLikes > 0
   };
};

module.exports = {
   likeSongService,
   unlikeSongService,
   getSongLikesService
};