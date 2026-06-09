const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');

const {
   addToQueueService,
   getCurrentSongService,
   nextSongService,
   prevSongService,
   allSongsService,
   clearQueueService,
   toggleShuffleService,
   toggleRepeatService
} = require('../services/queue.service');

// ➕ add song
const addToQueue = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const queue = await addToQueueService({
      userId: req.user.userId,
      songId: req.body.songId
   });

   return res.status(200).json({
      message: 'Added to queue',
      queue: queue.queue
   });
});

// 🎵 current song
const getCurrentSong = asyncHandler(async (req, res) => {

   const result = await getCurrentSongService(req.user.userId);

   return res.status(200).json(result);
});

// ⏭ next song
const nextSong = asyncHandler(async (req, res) => {

   const result = await nextSongService(req.user.userId);

   return res.status(200).json({
      message: result.message || 'Next song',
      currentIndex: result.currentIndex
   });
});

// ⏮ previous song
const prevSong = asyncHandler(async (req, res) => {

   const result = await prevSongService(req.user.userId);

   return res.status(200).json({
      message: 'Previous song',
      currentIndex: result.currentIndex
   });
});

// 📜 all songs
const allSongs = asyncHandler(async (req, res) => {

   const queue = await allSongsService(req.user.userId);

   return res.status(200).json({
      queue
   });
});

// ❌ clear queue
const clearQueue = asyncHandler(async (req, res) => {

   await clearQueueService(req.user.userId);

   return res.status(200).json({
      message: 'Queue cleared'
   });
});

// 🔀 shuffle
const toggleShuffle = asyncHandler(async (req, res) => {

   const isShuffle = await toggleShuffleService({
      userId: req.user.userId,
      shuffle: req.body.shuffle
   });

   return res.status(200).json({
      message: isShuffle ? 'Shuffle enabled' : 'Shuffle disabled',
      isShuffle
   });
});

// 🔁 repeat
const toggleRepeat = asyncHandler(async (req, res) => {

   const repeatMode = await toggleRepeatService({
      userId: req.user.userId,
      repeatMode: req.body.repeatMode
   });

   return res.status(200).json({
      message: 'Repeat updated',
      repeatMode
   });
});

module.exports = {
   addToQueue,
   getCurrentSong,
   nextSong,
   prevSong,
   allSongs,
   clearQueue,
   toggleShuffle,
   toggleRepeat
};