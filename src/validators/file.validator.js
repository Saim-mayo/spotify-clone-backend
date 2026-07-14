const path = require('path');
// === CHANGE START: Import fileTypeFromBuffer to inspect magic bytes ===
const { fileTypeFromBuffer } = require('file-type');
// === CHANGE END ===

// === CHANGE START: Make middleware function async to support fileTypeFromBuffer ===
const validateAudioFile = async (req, res, next) => {
// === CHANGE END ===

   const file = req.file;

   if (!file) {
      return res.status(400).json({
         message: 'File is required'
      });
   }

   // === CHANGE START: Inspect real magic bytes from the file buffer instead of trusting file.mimetype ===
   const detected = await fileTypeFromBuffer(file.buffer);
   const allowedMime = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];

   if (!detected || !allowedMime.includes(detected.mime)) {
      return res.status(400).json({
         message: 'Only audio files allowed'
      });
   }
   // === CHANGE END ===

   const ext = path.extname(file.originalname).toLowerCase();

   if (!['.mp3', '.wav'].includes(ext)) {
      return res.status(400).json({
         message: 'Invalid file extension'
      });
   }

   if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
         message: 'File too large (max 10MB)'
      });
   }

   next();
};

module.exports = validateAudioFile;