const allowed = [
   'image/png',
   'image/jpeg',
   'image/jpg',
   'image/webp'
];

const avatarCheck = (req, res, next) => {
   try {
      const file = req.file;

      if (!file) {
         return res.status(400).json({
            message: 'File is required'
         });
      }

      // MIME type check
      if (!allowed.includes(file.mimetype)) {
         return res.status(400).json({
            message: 'Only image files allowed (png, jpeg, jpg, webp)'
         });
      }

      next();
   } catch (error) {
      next(error);
   }
};

module.exports = avatarCheck;