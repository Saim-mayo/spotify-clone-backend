const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {

   try {

      // ==========================
      // GET TOKEN (COOKIE FIRST)
      // ==========================
      let token = null;

      if (req.cookies && req.cookies.accessToken) {
         token = req.cookies.accessToken;
      }
      else if (
         req.headers.authorization &&
         req.headers.authorization.startsWith('Bearer ')
      ) {
         token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
         return res.status(401).json({
            message: 'Unauthorized'
         });
      }

      // ==========================
      // VERIFY JWT
      // ==========================
      const decoded = jwt.verify(
         token,
         process.env.JWT_ACCESS_SECRET
      );

      // ==========================
      // LOAD USER FROM DATABASE
      // ==========================
      const user = await User.findById(decoded.userId).select(
         'username email role subscription artistVerification isBanned dailyUsage tokenVersion'
      );

      if (!user) {
         return res.status(401).json({
            message: 'User not found'
         });
      }

      // ==========================
      // TOKEN VERSION CHECK
      // ==========================
      if (decoded.tokenVersion !== user.tokenVersion) {
         return res.status(401).json({
            message: 'Session expired. Please login again'
         });
      }

      // ==========================
      // BANNED USER
      // ==========================
      if (user.isBanned) {
         return res.status(403).json({
            message: 'Account banned'
         });
      }

      // ==========================
      // AUTO EXPIRE PREMIUM
      // ==========================
      if (
         user.subscription?.expiresAt &&
         user.subscription.expiresAt < new Date()
      ) {

         // Local-only fallback: marks the cached plan as expired so this
         // request doesn't grant paid access, WITHOUT touching Stripe or
         // clearing the customer/subscription IDs — the webhook (which
         // talks to Stripe) remains the source of truth for the real state.
         user.subscription.plan = 'free';
         user.subscription.billingInterval = null;
         user.subscription.status = 'expired';

         await user.save();
      }

      // ====================================================
      // LIGHTWEIGHT USER CONTEXT
      // Used by controllers
      // ====================================================
      req.user = {

         userId: user._id,

         role: user.role,

         username: user.username,

         email: user.email,

         subscription: user.subscription,

         artistVerification: user.artistVerification,

         dailyUsage: user.dailyUsage,

         isBanned: user.isBanned

      };

      // ====================================================
      // ************* MA-01 FIX START ****************
      //
      // verifyMediaAccess() expected req.userDoc
      // but auth middleware never created it.
      //
      // We expose the loaded Mongo document once so
      // downstream middleware doesn't need another DB query.
      //
      // ====================================================

      req.userDoc = user;

      // Backward compatibility for any middleware
      // still using req.dbUser.
      req.dbUser = user;

      // ************** MA-01 FIX END ****************

      next();

   }

   catch (err) {

      console.error(err);

      if (err.name === 'TokenExpiredError') {
         return res.status(401).json({
            message: 'Access token expired'
         });
      }

      if (err.name === 'JsonWebTokenError') {
         return res.status(401).json({
            message: 'Invalid token'
         });
      }

      return res.status(500).json({
         message: 'Authentication error'
      });

   }

};

module.exports = authMiddleware;