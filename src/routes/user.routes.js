const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const multer = require('multer');
const avatarFileCheck = require('../middlewares/avatarFileCheck.middleware');

const userController = require('../controllers/user.controller');
const { updateProfileValidator } = require('../validators/user.validator');

const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 5 * 1024 * 1024 }
});

// 👤 get profile
router.get(
   '/me',
   authMiddleware,
   userController.getMyProfile
);

// ✏️ update profile
router.patch(
   '/me',
   authMiddleware,
   updateProfileValidator,
   validate,
   userController.updateMyProfile
);

// 🖼️ upload avatar
router.post(
   '/me/avatar',
   authMiddleware,

   upload.single('avatar'),
   avatarFileCheck, // ✅ ADD THIS

   userController.uploadAvatar
);

module.exports = router;