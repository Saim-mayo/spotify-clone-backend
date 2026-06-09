const path = require('path');

/**
 * FILE VALIDATION MIDDLEWARE (FIXED)
 * ----------------------------------
 * WHY:
 * 1. Ensures ONLY audio files pass
 * 2. Prevents Image/Video upload into music API (your bug)
 * 3. Protects ImageKit + storage service from crash (500 error)
 */

const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];

const fileCheck = (req, res, next) => {
   try {

      const file = req.file;

      if (!file) {
         return res.status(400).json({
            message: 'File is required'
         });
      }

      // MIME TYPE CHECK
      if (!allowedTypes.includes(file.mimetype)) {
         return res.status(400).json({
            message: 'Only audio files allowed (mp3, wav)'
         });
      }

      // SIZE CHECK (10MB)
      if (file.size > 10 * 1024 * 1024) {
         return res.status(400).json({
            message: 'File too large (max 10MB)'
         });
      }

      // EXTENSION CHECK
      const ext = path.extname(file.originalname).toLowerCase();

      if (!['.mp3', '.wav'].includes(ext)) {
         return res.status(400).json({
            message: 'Invalid file extension'
         });
      }

      next();

   } catch (error) {
      next(error);
   }
};

module.exports = fileCheck;