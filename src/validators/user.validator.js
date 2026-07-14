const { body } = require('express-validator');

// =====================================
// UPDATE PROFILE
// =====================================

const updateProfileValidator = [

   body('username')
      .optional()
      .isLength({ min: 3 })
      .withMessage('Username too short'),

   body('bio').optional()
      .isLength({ max: 500 })
      .withMessage('Bio too long')

];

// =====================================
// SET PASSWORD
// =====================================

const setPasswordValidator = [

   body('password')

      .notEmpty()

      .withMessage('Password required')

      .isLength({ min: 6 })

      .withMessage('Password must be at least 6 characters')

];

module.exports = {

   updateProfileValidator,

   setPasswordValidator

};