const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const likeController = require('../controllers/like.controller');

const {
   likeSongValidator,
   unlikeSongValidator,
   getSongLikesValidator
} = require('../validators/like.validator');

// ❤️ like song
router.post(
   '/like',
   authMiddleware,
   likeSongValidator,
   validate,
   likeController.likeSong
);

// 💔 unlike song
router.post(
   '/unlike',
   authMiddleware,
   unlikeSongValidator,
   validate,
   likeController.unlikeSong
);

// 📊 get likes
router.get(
   '/likes/:songId',
   authMiddleware,
   getSongLikesValidator,
   validate,
   likeController.getSongLikes
);

module.exports = router;