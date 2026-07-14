const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');

const {
   createPlaylistService,
   addSongToPlaylistService,
   removeSongFromPlaylistService,
   getMyPlaylistsService,
   getPlaylistByIdService,
   removePlaylistService
} = require('../services/playlist.service');

// 🎧 Create playlist
const createPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const playlist = await createPlaylistService({
      title: req.body.title,
      userId: req.user.userId,
      isPublic: req.body.isPublic
   });

   return res.status(201).json({
      message: 'Playlist created',
      playlist
   });
});

// ➕ Add song
const addSongToPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const playlist = await addSongToPlaylistService({
      playlistId: req.body.playlistId,
      songId: req.body.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song added to playlist',
      playlist
   });
});

// ❌ Remove song
const removeSongFromPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const playlist = await removeSongFromPlaylistService({
      playlistId: req.body.playlistId,
      songId: req.body.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song removed from playlist',
      playlist
   });
});

// 📄 My playlists
const getMyPlaylists = asyncHandler(async (req, res) => {

   const playlists = await getMyPlaylistsService(req.user.userId);

   return res.status(200).json({
      total: playlists.length,
      playlists
   });
});

// 📄 Get playlist by ID
const getPlaylistById = asyncHandler(async (req, res) => {

   const playlist = await getPlaylistByIdService(req.params.playlistId, req.user.userId   );

   return res.status(200).json({
      playlist
   });
});

// 🗑️ Delete playlist
const removePlaylist = asyncHandler(async (req, res) => {

await removePlaylistService(
   req.params.playlistId,
   req.user.userId
);

   return res.status(200).json({
      message: 'Playlist deleted successfully'
   });
});

module.exports = {
   createPlaylist,
   addSongToPlaylist,
   removeSongFromPlaylist,
   getMyPlaylists,
   getPlaylistById,
   removePlaylist
};