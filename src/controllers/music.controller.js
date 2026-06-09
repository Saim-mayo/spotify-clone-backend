const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');
const {
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
} = require('../services/music.service');

// 🎵 create song
const createSong = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const music = await createSongService({
      title: req.body.title,
      file: req.file,
      userId: req.user.userId
   });

   return res.status(201).json({
      message: 'Music created successfully',
      music
   });
});

// ▶ play song
const playSong = asyncHandler(async (req, res) => {

   const song = await playSongService({
      songId: req.params.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song played',
      playCount: song.playCount
   });
});

// 🔍 search songs
const searchSongs = asyncHandler(async (req, res) => {

   const songs = await searchSongsService(req.query.q);

   return res.status(200).json({
      total: songs.length,
      results: songs
   });
});

// 👤 search artists
const searchArtists = asyncHandler(async (req, res) => {

   const artists = await searchArtistsService(req.query.q);

   return res.status(200).json({
      total: artists.length,
      results: artists
   });
});

// 💿 create album
const createAlbum = asyncHandler(async (req, res) => {

   const album = await createAlbumService({
      title: req.body.title,
      musics: req.body.musics,
      userId: req.user.userId
   });

   return res.status(201).json({
      message: 'Album created successfully',
      album
   });
});

// 📀 all songs
const getAllSongs = asyncHandler(async (req, res) => {

   const songs = await getAllSongsService({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
   });

   return res.status(200).json({
      message: 'Songs fetched successfully',
      songs
   });
});

// 📀 all albums
const getAllAlbums = asyncHandler(async (req, res) => {

   const albums = await getAllAlbumsService({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
   });

   return res.status(200).json({
      message: 'Albums fetched successfully',
      albums
   });
});

// 📀 album by id
const getAlbumById = asyncHandler(async (req, res) => {

   const album = await getAlbumByIdService(req.params.albumId);

   return res.status(200).json({
      message: 'Album fetched successfully',
      album
   });
});

// 🔥 trending songs
const getTrendingSongs = asyncHandler(async (req, res) => {

   const songs = await getTrendingSongsService();

   return res.status(200).json({
      total: songs.length,
      songs
   });
});

// 📜 history
const getUserHistory = asyncHandler(async (req, res) => {

   const history = await getUserHistoryService(req.user.userId);

   return res.status(200).json({
      total: history.length,
      history
   });
});

module.exports = {
   createSong,
   playSong,
   searchSongs,
   searchArtists,
   createAlbum,
   getAllSongs,
   getAllAlbums,
   getAlbumById,
   getTrendingSongs,
   getUserHistory
};