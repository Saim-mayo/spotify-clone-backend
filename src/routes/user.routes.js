const AppError = require('../utils/appError');
const express = require('express');
const router = express.Router();
const multer = require('multer');

// middleware
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

// controller
const userController = require('../controllers/user.controller');

// validator
const { updateProfileValidator, setPasswordValidator } = require('../validators/user.validator');
const validateAvatar = require('../validators/avatar.validator'); // ✅ FIXED IMPORT

// upload config
const upload = multer({
   storage: multer.memoryStorage(),

   limits: { fileSize: 5 * 1024 * 1024 }, // adjust if needed

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
// 👤 GET PROFILE
// =====================================
router.get(
   '/me',
   authMiddleware,
   userController.getMyProfile
);


// =====================================
// 🎛 GET MY FEATURE FLAGS (ads / downloads / daily limit)
// =====================================
router.get(
   '/me/features',
   authMiddleware,
   userController.getMyFeatures
);


// =====================================
// ✏️ UPDATE PROFILE
// =====================================
router.patch(
   '/me',
   authMiddleware,
   updateProfileValidator,
   validate,
   userController.updateMyProfile
);


// =====================================
// 🖼️ UPLOAD AVATAR
// =====================================
router.post(
   '/me/avatar',
   authMiddleware,
   upload.single('avatar'),

   // ✅ validation layer (NEW CLEAN DESIGN)
   validateAvatar,

   userController.uploadAvatar
);
// =====================================
// SET PASSWORD
// =====================================

router.patch(

   '/set-password',

   authMiddleware,

   setPasswordValidator,

   validate,

   userController.setPassword

);
// =====================================
// 🎤 REQUEST ARTIST ACCESS
// =====================================
router.post(
   '/artist/request',
   authMiddleware,
   userController.requestArtistVerification
);

module.exports = router;