const AppError = require('../utils/appError');
const express = require('express');
const router = express.Router();
const multer = require('multer');

// controllers
const musicController = require('../controllers/music.controller');

// middleware
const authMiddleware = require('../middlewares/auth.middleware');
const {
   streamLimiter,
   uploadLimiter,
   searchLimiter
} = require("../middlewares/rateLimit.middleware");

const {
   requireVerifiedArtist
} = require('../middlewares/permission.middleware');

const {
   allowDownload,
   allowPlay
} = require('../middlewares/access.middleware');
const {
   logDownload
} = require('../middlewares/downloadAudit.middleware');

const { checkDailyLimit } = require('../middlewares/usage.middleware');
const {
   verifyMediaAccess
} = require('../middlewares/mediaAccess.middleware');
// validators
const {
   createSongValidation,
   songIdValidator,
   albumIdValidator
} = require('../validators/music.validator');

const validateAudioFile = require('../validators/file.validator');
const { createAlbumValidation } = require('../validators/album.validator');
const validate = require('../middlewares/validate.middleware');

// upload config
const upload = multer({
   storage: multer.memoryStorage(),

   limits: { fileSize: 10 * 1024 * 1024 }, // adjust if needed

   fileFilter: (req, file, cb) => {
      /**
       * 🔒 SECURITY: restrict file types
       */

      // avatar → images only
      if (file.fieldname === 'avatar') {
         if (!file.mimetype.startsWith('image/')) {
            return cb(new AppError('Only image files allowed', 400), false);
         }
      }

      // music → audio only
      if (file.fieldname === 'music') {
         if (!file.mimetype.startsWith('audio/')) {
            return cb(new AppError('Only audio files allowed', 400), false);
         }
      }

      cb(null, true);
   }
});

// =====================================
// 🌍 PUBLIC ROUTES
// =====================================

router.get('/all-songs', musicController.getAllSongs);

router.get('/all-albums', musicController.getAllAlbums);

router.get(
   '/albums/:albumId',
   albumIdValidator,
   validate,
   musicController.getAlbumById
);

router.get('/search/songs', searchLimiter, musicController.searchSongs);

router.get('/search/artists', searchLimiter, musicController.searchArtists);

router.get('/trending', musicController.getTrendingSongs);


// =====================================
// 👤 USER ROUTES
// =====================================

// ▶ PLAY SONG (FREE + PREMIUM)
router.post(
   '/play/:songId',
   authMiddleware,
   songIdValidator,   // ✅ validate first
   validate,
   allowPlay,         // ✅ then access control
   checkDailyLimit,
   musicController.playSong
);

// 🎧 STREAM SONG (FREE + PREMIUM)
router.get(
   '/stream/:songId',
   streamLimiter,
   authMiddleware,
   songIdValidator,
   validate,
   allowPlay,
   checkDailyLimit,
   verifyMediaAccess('stream'),
   musicController.streamSong
);

// 📜 HISTORY
router.get(
   '/history',
   authMiddleware,
   musicController.getUserHistory
);


// =====================================
// 🎤 ARTIST ROUTES
// =====================================

// UPLOAD SONG
router.post(
   '/upload', uploadLimiter,
   authMiddleware,
   requireVerifiedArtist,
   upload.single('music'),
   validateAudioFile,
   createSongValidation,
   validate,
   musicController.createSong
);

// CREATE ALBUM
router.post(
   '/album',
   authMiddleware,
   requireVerifiedArtist,
   createAlbumValidation,
   validate,
   musicController.createAlbum
);


// =====================================
// 💳 PREMIUM ROUTES
// =====================================

// ⬇ DOWNLOAD SONG (PREMIUM ONLY)
router.get(
   '/download/:songId',
   streamLimiter,
   authMiddleware,
   songIdValidator,
   validate,
   checkDailyLimit,
   allowDownload,
   verifyMediaAccess('download'),
   logDownload,
   musicController.downloadSong
);


module.exports = router;