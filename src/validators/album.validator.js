const { body } = require('express-validator');

const createAlbumValidation = [
   body('title')
      .notEmpty()
      .withMessage('Album title is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Album title must be 2-100 characters'),

   body('musics')
      .isArray({ min: 1 })
      .withMessage('At least one music is required'),

   body('musics.*')
      .isMongoId()
      .withMessage('Invalid music ID in album')
];

module.exports = {
   createAlbumValidation
};