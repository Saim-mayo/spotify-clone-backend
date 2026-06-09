const { body } = require('express-validator');
const { param } = require('express-validator');
const createPlaylistValidator = [
   body('title')
      .notEmpty().withMessage('title is required')
      .isLength({ min: 2 }).withMessage('title too short'),

   body('isPublic')
      .optional()
      .isBoolean().withMessage('isPublic must be boolean')
];

const songActionValidator = [
   body('playlistId')
      .notEmpty().withMessage('playlistId required')
      .isMongoId().withMessage('Invalid playlistId'),

   body('songId')
      .notEmpty().withMessage('songId required')
      .isMongoId().withMessage('Invalid songId')
];
const playlistIdParamValidator = [
   param('playlistId')
      .isMongoId()
      .withMessage('Invalid playlistId')
];
module.exports = {
   createPlaylistValidator,
   songActionValidator,
   playlistIdParamValidator
};