const express = require('express');
const router = express.Router();

const playlistController = require('../controllers/playlist.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
   createPlaylistValidator,
   songActionValidator,
   playlistIdParamValidator
} = require('../validators/playlist.validator');

// 🎧 create playlist
router.post(
   '/',
   authMiddleware,
   createPlaylistValidator,
   validate,
   playlistController.createPlaylist
);

// ➕ add song
router.post(
   '/add-song',
   authMiddleware,
   songActionValidator,
   validate,
   playlistController.addSongToPlaylist
);

// ❌ remove song
router.post(
   '/remove-song',
   authMiddleware,
   songActionValidator,
   validate,
   playlistController.removeSongFromPlaylist
);

// 📄 get my playlists
router.get('/user', authMiddleware, playlistController.getMyPlaylists);

// 📄 get by id
router.get('/:playlistId', authMiddleware,playlistIdParamValidator,validate, playlistController.getPlaylistById);

// 🗑 delete
router.delete('/:playlistId', authMiddleware, playlistIdParamValidator,validate, playlistController.removePlaylist);

module.exports = router;