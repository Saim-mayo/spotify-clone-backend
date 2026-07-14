const express = require('express');
const router = express.Router();

// =====================
// PUBLIC / CORE ROUTES
// =====================
router.use('/auth', require('./auth.routes'));
router.use('/music', require('./music.routes'));
router.use('/users', require('./user.routes'));

// =====================
// SOCIAL FEATURES
// =====================
router.use('/likes', require('./like.routes'));
router.use('/playlists', require('./playlist.routes'));
router.use('/queue', require('./queue.routes'));

// =====================
// ADMIN
// =====================
router.use('/admin', require('./admin.routes'));

// =====================
// STRIPE / PAYMENT SYSTEM
// =====================
router.use('/payment', require('./payment.routes'));

// ⚠️ IMPORTANT: webhook should be handled separately in app.js
// NOT inside express.json routes

module.exports = router;