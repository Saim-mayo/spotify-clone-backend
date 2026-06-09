const express = require('express');
const musicController = require('../controllers/music.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { isArtist } = require('../middlewares/role.middleware');
const multer = require('multer');
const fileCheck = require('../middlewares/fileCheck.middleware');
const { createSongValidation, songIdValidator, albumIdValidator } = require('../validators/music.validator');
const validate = require('../middlewares/validate.middleware');
const router = express.Router();

const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 🎵 Upload song (artist only)
router.post(
   '/upload-music',
   authMiddleware,
   isArtist,
   upload.single('music'),
   fileCheck,
   createSongValidation,
   validate,
   musicController.createSong
);

// ▶ play song
router.post(
   '/play/:songId',
   authMiddleware,
   songIdValidator,
   validate,
   musicController.playSong
);

// 💿 album create
router.post(
   '/create-album',
   authMiddleware,
   isArtist,
   musicController.createAlbum
);

// 📀 get songs
router.get(
   '/all-songs',
   musicController.getAllSongs
);

// 📀 albums
router.get(
   '/all-albums',
   authMiddleware,
   musicController.getAllAlbums
);

// 📀 album by id
router.get(
   '/albums/:albumId',
   albumIdValidator,
   validate,
   authMiddleware,
   musicController.getAlbumById
);

// 🔍 search songs
router.get(
   '/search/songs',
   authMiddleware,
   musicController.searchSongs
);

// 🔍 search artists
router.get(
   '/search/artists',
   authMiddleware,
   musicController.searchArtists
);

// 🔥 trending
router.get(
   '/trending',
   authMiddleware,
   musicController.getTrendingSongs
);

// 📜 history
router.get(
   '/user/history',
   authMiddleware,
   musicController.getUserHistory
);

module.exports = router;