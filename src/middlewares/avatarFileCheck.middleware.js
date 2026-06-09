const path = require('path');

const allowedImageTypes = [
   'image/jpeg',
   'image/png',
   'image/jpg',
   'image/webp'
];

/**
 * 🖼️ Avatar file validator middleware
 * WHY: Prevent MP3/video upload into avatar field
 */
const avatarFileCheck = (req, res, next) => {
   try {
      const file = req.file;

      if (!file) {
         return res.status(400).json({
            message: 'Avatar file is required'
         });
      }

      // ❌ block non-image files
      if (!allowedImageTypes.includes(file.mimetype)) {
         return res.status(400).json({
            message: 'Only image files allowed (jpg, png, webp)'
         });
      }

      // ❌ extension check
      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
         return res.status(400).json({
            message: 'Invalid image extension'
         });
      }

      next();

   } catch (err) {
      next(err);
   }
};

module.exports = avatarFileCheck;