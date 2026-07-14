const mongoose = require('mongoose');
const QueueModel = require('../models/queue.model');
const MusicModel = require('../models/music.model');
const AppError = require('../utils/appError');

/**
 * =========================
 * ➕ ADD TO QUEUE (FIXED)
 * =========================
 */
const addToQueueService = async ({ userId, songId }) => {

   // ✅ VALIDATE ID
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid songId', 400);
   }

   // ✅ CHECK SONG EXISTS
   const song = await MusicModel.findById(songId).lean();
   if (!song) {
      throw new AppError('Song not found', 404);
   }

   let queueDoc = await QueueModel.findOne({ user: userId });

   if (!queueDoc) {
      queueDoc = await QueueModel.create({
         user: userId,
         queue: [songId],
         currentIndex: 0,
         isShuffle: false,
         repeatMode: 'off'
      });
   } else {

      // ✅ PREVENT DUPLICATES
      queueDoc.queue.addToSet(songId);

      await queueDoc.save();
   }

   return queueDoc;
};


/**
 * =========================
 * 🎵 CURRENT SONG
 * =========================
 */
const getCurrentSongService = async (userId) => {

   const queueDoc = await QueueModel.findOne({ user: userId })
      .populate('queue');

   if (!queueDoc || queueDoc.queue.length === 0) {
      throw new AppError('Queue is empty', 404);
   }

   const song = queueDoc.queue[queueDoc.currentIndex];

   if (!song) {
      throw new AppError('Invalid queue index', 400);
   }

   return {
      currentIndex: queueDoc.currentIndex,
      song
   };
};


/**
 * =========================
 * ⏭ NEXT SONG (FIXED FLOW)
 * =========================
 */
const nextSongService = async (userId) => {

   const queueDoc = await QueueModel.findOne({ user: userId });

   if (!queueDoc || queueDoc.queue.length === 0) {
      throw new AppError('Queue is empty', 404);
   }

   // repeat one
   if (queueDoc.repeatMode === 'one') {
      return {
         currentIndex: queueDoc.currentIndex,
         message: 'Repeating current song'
      };
   }

   // shuffle
   if (queueDoc.isShuffle) {
      let randomIndex;

      do {
         randomIndex = Math.floor(Math.random() * queueDoc.queue.length);
      } while (
         randomIndex === queueDoc.currentIndex &&
         queueDoc.queue.length > 1
      );

      queueDoc.currentIndex = randomIndex;
   }

   // normal next
   else if (queueDoc.currentIndex < queueDoc.queue.length - 1) {
      queueDoc.currentIndex++;
   }

   // repeat all
   else if (queueDoc.repeatMode === 'all') {
      queueDoc.currentIndex = 0;
   }

   await queueDoc.save();

   return {
      currentIndex: queueDoc.currentIndex
   };
};


/**
 * =========================
 * ⏮ PREVIOUS SONG (FIXED)
 * =========================
 */
const prevSongService = async (userId) => {

   const queueDoc = await QueueModel.findOne({ user: userId });

   if (!queueDoc || queueDoc.queue.length === 0) {
      throw new AppError('Queue is empty', 404);
   }

   if (queueDoc.repeatMode === 'one') {
      return {
         currentIndex: queueDoc.currentIndex,
         message: 'Repeating current song'
      };
   }

   if (queueDoc.currentIndex > 0) {
      queueDoc.currentIndex--;
      await queueDoc.save();
   }

   return {
      currentIndex: queueDoc.currentIndex
   };
};


/**
 * =========================
 * 📜 ALL SONGS
 * =========================
 */
const allSongsService = async (userId) => {

   const queueDoc = await QueueModel.findOne({ user: userId })
      .populate('queue');

   if (!queueDoc || queueDoc.queue.length === 0) {
      throw new AppError('Queue is empty', 404);
   }

   return queueDoc.queue;
};
/**
 * =========================
 * ❌ CLEAR QUEUE (SAFE RESET)
 * =========================
 */
const clearQueueService = async (userId) => {

   const queueDoc = await QueueModel.findOne({ user: userId });

   if (!queueDoc) {
      throw new AppError('Queue not found', 404);
   }

   queueDoc.queue = [];
   queueDoc.currentIndex = 0;
   queueDoc.isShuffle = false;
   queueDoc.repeatMode = 'off';

   await queueDoc.save();

   return {
      message: 'Queue cleared successfully'
   };
};


/**
 * =========================
 * 🔀 SHUFFLE
 * =========================
 */
/**
 * =========================
 * 🔀 SHUFFLE
 * =========================
 */
const toggleShuffleService = async ({ userId, shuffle }) => {

   if (typeof shuffle !== 'boolean') {
      throw new AppError('shuffle must be boolean', 400);
   }

   const queueDoc = await QueueModel.findOneAndUpdate(
      { user: userId },
      { isShuffle: shuffle },
      {
         returnDocument: 'after'
      }
   );

   if (!queueDoc) {
      throw new AppError('Queue not found', 404);
   }

   return queueDoc.isShuffle;
};


/**
 * =========================
 * 🔁 REPEAT
 * =========================
 */
const toggleRepeatService = async ({ userId, repeatMode }) => {

   const allowed = ['off', 'one', 'all'];

   if (!allowed.includes(repeatMode)) {
      throw new AppError('Invalid repeat mode', 400);
   }

   const queueDoc = await QueueModel.findOneAndUpdate(
      { user: userId },
      { repeatMode },
      {
         returnDocument: 'after'
      }
   );

   if (!queueDoc) {
      throw new AppError('Queue not found', 404);
   }

   return queueDoc.repeatMode;
};

module.exports = {
   addToQueueService,
   getCurrentSongService,
   nextSongService,
   prevSongService,
   allSongsService,
   clearQueueService,
   toggleShuffleService,
   toggleRepeatService
};