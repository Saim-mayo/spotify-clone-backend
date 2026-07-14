const asyncHandler = require('../utils/asyncHandler');
const axios = require('axios');
const AppError = require('../utils/appError');
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

const {
   getInternalFileUrl
} = require('../services/storage.service');
const {
   recordDownload,
   getUserDownloads

} = require('../services/download.service');

// =====================================
// 🎯 SECURE AUDIO DELIVERY ENGINE (FIXED)
// =====================================
const handleAudioDelivery = async (req, res, mode = 'stream') => {

   const songId = req.params.songId;

   // ===============================
   // 🔒 VALIDATE SONG
   // ===============================
   const song = req.song;

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   if (!song.filePath) {
      throw new AppError('File path missing', 400);
   }



   // ===============================
   // 🔐 GENERATE SIGNED URL
   // ===============================
   const mediaUrl = getInternalFileUrl(song.filePath);

   // ===============================
   // 🔒 SSRF PROTECTION (SIMPLE + STRONG)
   // ===============================
   if (!mediaUrl.startsWith(process.env.IMAGE_KIT_URL_ENDPOINT)) {
      throw new AppError('Invalid file source', 400);
   }

   // =====================================
   // ⬇ DOWNLOAD MODE
   // =====================================
   if (mode === "download") {

      const response = await axios({
         method: "GET",
         url: mediaUrl,
         responseType: "stream"
      });

      res.writeHead(200, {

         "Content-Type": "application/octet-stream",

         "Content-Disposition":
            `attachment; filename="${song.title}.mp3"`,

         "Content-Length":
            response.headers["content-length"],

         "Cache-Control":
            "private, no-store",

         "X-Content-Type-Options":
            "nosniff"

      });

      return response.data.pipe(res);
   }

   // =====================================
   // 🎧 STREAM MODE
   // =====================================

   const range = req.headers.range;

   if (!range) {
      throw new AppError('Range header required', 416);
   }
   // Allow: bytes=0-   bytes=0-100   bytes=500-1000
   if (!/^bytes=\d+-\d*$/.test(range)) {
      throw new AppError('Invalid range header', 400);
   }

   const head = await axios.head(mediaUrl);
   const fileSize = parseInt(head.headers['content-length'], 10);

   if (!fileSize) {
      throw new AppError('Unable to determine file size', 500);
   }

   const CHUNK_SIZE = 1 * 1024 * 1024;

   const start = Number(range.replace(/\D/g, ''));

   if (start >= fileSize) {
      throw new AppError('Range not satisfiable', 416);
   }

   const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
   const contentLength = end - start + 1;

   res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'audio/mpeg'
   });

   const stream = await axios({
      method: 'GET',
      url: mediaUrl,
      responseType: 'stream',
      headers: {
         Range: `bytes=${start}-${end}`
      }
   });

   stream.data.pipe(res);
};

// =====================================
// 🎵 CREATE SONG
// =====================================
const createSong = asyncHandler(async (req, res) => {

   if (!req.file) {
      throw new AppError('Audio file is required', 400);
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

// =====================================
// ▶ PLAY SONG
// =====================================
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

// =====================================
// 🎧 STREAM SONG
// =====================================
const streamSong = asyncHandler(async (req, res) => {
   return handleAudioDelivery(req, res, 'stream');
});

// =====================================
// 📥 DOWNLOAD SONG
// =====================================
const downloadSong = asyncHandler(async (req, res) => {

   await recordDownload({

      user: req.user,

      songId: req.song._id,

      ipAddress: req.ip,

      userAgent: req.get('user-agent') || ''

   });

   return handleAudioDelivery(req, res, 'download');

});

// =====================================
// 🔍 SEARCH SONGS
// =====================================
const searchSongs = asyncHandler(async (req, res) => {

   const query = (req.query.q || '').trim();

   if (!query) {
      throw new AppError('Search query required', 400);
   }

   const songs = await searchSongsService(query);

   return res.status(200).json({
      total: songs.length,
      results: songs
   });
});

// =====================================
// 👤 SEARCH ARTISTS
// =====================================
const searchArtists = asyncHandler(async (req, res) => {

   const query = (req.query.q || '').trim();

   if (!query) {
      throw new AppError('Search query required', 400);
   }

   const artists = await searchArtistsService(query);

   return res.status(200).json({
      total: artists.length,
      results: artists
   });
});

// =====================================
// 💿 CREATE ALBUM
// =====================================
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

// =====================================
// 📀 ALL SONGS
// =====================================
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

// =====================================
// 📀 ALL ALBUMS
// =====================================
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

// =====================================
// 📀 ALBUM BY ID
// =====================================
const getAlbumById = asyncHandler(async (req, res) => {

   const album = await getAlbumByIdService(req.params.albumId);

   return res.status(200).json({
      message: 'Album fetched successfully',
      album
   });
});

// =====================================
// 🔥 TRENDING SONGS
// =====================================
const getTrendingSongs = asyncHandler(async (req, res) => {

   const songs = await getTrendingSongsService();

   return res.status(200).json({
      total: songs.length,
      songs
   });
});

// =====================================
// 📜 USER HISTORY
// =====================================
const getUserHistory = asyncHandler(async (req, res) => {

   const history = await getUserHistoryService(req.user.userId);

   return res.status(200).json({
      total: history.length,
      history
   });
});
// =====================================
// 📥 USER DOWNLOAD HISTORY
// =====================================
const getMyDownloads = asyncHandler(async (req, res) => {

   const downloads = await getUserDownloads(req.user.userId);

   return res.status(200).json({

      total: downloads.length,

      downloads

   });

});
// =====================================
// EXPORTS
// =====================================
module.exports = {
   createSong,
   playSong,
   streamSong,
   downloadSong,
   searchSongs,
   searchArtists,
   createAlbum,
   getAllSongs,
   getAllAlbums,
   getAlbumById,
   getTrendingSongs,
   getUserHistory,
   getMyDownloads
};