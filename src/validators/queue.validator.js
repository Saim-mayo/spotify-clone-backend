const { body } = require('express-validator');

const addToQueueValidator = [
   body('songId')
      .notEmpty().withMessage('songId is required')
      .isMongoId().withMessage('Invalid songId')
];

const toggleShuffleValidator = [
   body('shuffle')
   .isBoolean()
   .toBoolean()
   .withMessage('shuffle must be boolean')
];

const toggleRepeatValidator = [
   body('repeatMode')
      .isIn(['off', 'one', 'all'])
      .withMessage('Invalid repeatMode')
];

module.exports = {
   addToQueueValidator,
   toggleShuffleValidator,
   toggleRepeatValidator
};