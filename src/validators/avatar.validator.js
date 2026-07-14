const path = require('path');

const allowedTypes = [
   'image/png',
   'image/jpeg',
   'image/jpg',
   'image/webp'
];

const validateAvatar = (req, res, next) => {

   const file = req.file;

   if (!file) {
      return res.status(400).json({
         message: 'Avatar file is required'
      });
   }

   // MIME CHECK
   if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
         message: 'Only image files allowed (png, jpg, jpeg, webp)'
      });
   }

   // EXTENSION CHECK
   const ext = path.extname(file.originalname).toLowerCase();

   if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return res.status(400).json({
         message: 'Invalid image extension'
      });
   }

   next();
};

module.exports = validateAvatar;