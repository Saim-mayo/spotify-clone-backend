const { body, param } = require('express-validator');

const likeSongValidator = [
   body('songId')
      .notEmpty().withMessage('songId is required')
      .isMongoId().withMessage('Invalid songId')
];

const unlikeSongValidator = [
   body('songId')
      .notEmpty().withMessage('songId is required')
      .isMongoId().withMessage('Invalid songId')
];

const getSongLikesValidator = [
   param('songId')
      .notEmpty().withMessage('songId is required')
      .isMongoId().withMessage('Invalid songId')
];

module.exports = {
   likeSongValidator,
   unlikeSongValidator,
   getSongLikesValidator
};