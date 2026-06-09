const { body } = require('express-validator');
const { param } = require('express-validator');
const createSongValidation = [
   body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 2 })
      .withMessage('Title too short')
];

const songIdValidator = [
   param('songId').isMongoId().withMessage('Invalid songId')
];

const albumIdValidator = [
   param('albumId').isMongoId().withMessage('Invalid albumId')
];
module.exports = {
   createSongValidation,
   songIdValidator,
   albumIdValidator
};