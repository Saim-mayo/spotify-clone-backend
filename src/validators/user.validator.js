const { body } = require('express-validator');

// ✏️ update profile validation
const updateProfileValidator = [
   body('username')
      .optional()
      .isLength({ min: 3 })
      .withMessage('Username too short'),

   body('bio')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Bio too long')
];

module.exports = {
   updateProfileValidator
};