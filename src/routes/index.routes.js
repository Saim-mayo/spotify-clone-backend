const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/music', require('./music.routes'));
router.use('/likes', require('./like.routes'));
router.use('/playlists', require('./playlist.routes'));
router.use('/queue', require('./queue.routes'));
router.use('/users', require('./user.routes'));
module.exports = router;