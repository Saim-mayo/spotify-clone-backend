const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { registerValidation, loginValidation } = require('../validators/auth.validator');
const router = express.Router();

// REGISTER
router.post(
   '/register',
   [
      body('username')
         .notEmpty().withMessage('Username is required')
         .isLength({ min: 3 }).withMessage('Username too short'),

      body('email')
         .isEmail().withMessage('Invalid email')
         .normalizeEmail(),

      body('password')
         .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

      body('role')
         .optional()
         .isIn(['user', 'artist']).withMessage('Invalid role')
   ],registerValidation,
   authController.registerUser
);

// LOGIN (FIXED - PRODUCTION VALIDATION)
router.post(
   '/login',
   [
      body('email')
         .optional()
         .isEmail()
         .withMessage('Invalid email'),

      body('username')
         .optional()
         .isString()
         .withMessage('Invalid username'),

      body('password')
         .notEmpty()
         .withMessage('Password required')
         .custom((value, { req }) => {
            if (!req.body.email && !req.body.username) {
               throw new Error('Email or username required');
            }
            return true;
         })
   ],
   authController.loginUser
);

// REFRESH TOKEN
router.post(
   '/refresh-token',
   [
      body('refreshToken')
         .optional()
         .isString()
         .withMessage('Invalid refresh token')
   ],
   loginValidation,
   authController.refreshAccessToken
);
router.post('/logout', authController.logoutUser);
module.exports = router;