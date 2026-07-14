const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');

const authController = require('../controllers/auth.controller');

const {
   registerValidation,
   loginValidation
} = require('../validators/auth.validator');

const {
   authLimiter,
   refreshLimiter
} = require('../middlewares/rateLimit.middleware');

// =====================================
// REGISTER
// =====================================

router.post(
   '/register',
   authLimiter,
   registerValidation,
   authController.registerUser
);

// =====================================
// LOGIN
// =====================================

router.post(
   '/login',
   authLimiter,
   loginValidation,
   authController.loginUser
);

// =====================================
// GOOGLE LOGIN
// =====================================

router.get('/google', (req, res, next) => {

   const state = crypto.randomBytes(32).toString('hex');

   res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: false,          // development
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000
   });

   passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state: state
   })(req, res, next);

});

// =====================================
// GOOGLE CALLBACK
// =====================================

router.get(

   '/google/callback',

   (req, res, next) => {

      
      if (
         !req.query.state ||
         req.query.state !== req.cookies.oauth_state
      ) {
         return res.status(403).json({
            message: 'OAuth state mismatch'
         });
      }

      res.clearCookie('oauth_state');

      next();

   },

   passport.authenticate('google', {
      session: false
   }),

   authController.googleLogin

);

// =====================================
// REFRESH TOKEN
// =====================================

router.post(
   '/refresh-token',
   refreshLimiter,
   authController.refreshAccessToken
);

// =====================================
// LOGOUT
// =====================================

router.post(
   '/logout',
   authController.logoutUser
);

module.exports = router;