const express = require('express');
const router = express.Router();

const queueController = require('../controllers/queue.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
   addToQueueValidator,
   toggleShuffleValidator,
   toggleRepeatValidator
} = require('../validators/queue.validator');

// ➕ add song
router.post(
   '/add',
   authMiddleware,
   addToQueueValidator,
   validate,
   queueController.addToQueue
);

// 🔀 shuffle
router.post(
   '/shuffle',
   authMiddleware,
   toggleShuffleValidator,
   validate,
   queueController.toggleShuffle
);

// 🔁 repeat
router.post(
   '/repeat',
   authMiddleware,
   toggleRepeatValidator,
   validate,
   queueController.toggleRepeat
);

// others remain same
router.get('/current', authMiddleware, queueController.getCurrentSong);
router.post('/next', authMiddleware, queueController.nextSong);
router.post('/prev', authMiddleware, queueController.prevSong);
router.get('/all', authMiddleware, queueController.allSongs);
router.delete('/clear', authMiddleware, queueController.clearQueue);

module.exports = router;