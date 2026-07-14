const { body } = require('express-validator');

const registerValidation = [
   body('username')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters'),

   body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail(),

   body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')

];

const loginValidation = [
   body('email').optional().isEmail().normalizeEmail(),
   body('username').optional().isLength({ min: 3 }),
   body('password').notEmpty().withMessage('Password required'),
   body().custom((value) => {
      if (!value.email && !value.username) {
         throw new Error('Email or username required');
      }
      return true;
   })
];

module.exports = {
   registerValidation,
   loginValidation
};