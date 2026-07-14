const AppError = require('../utils/appError');
const userModel = require('../models/user.model');

// =====================================
// 🔒 LOAD USER FROM DB (CRITICAL)
// =====================================
const attachFreshUser = async (req, res, next) => {
   if (!req.user?.userId) {
      return next(new AppError('Unauthorized', 401));
   }

   const user = await userModel.findById(req.user.userId);

   if (!user) {
      return next(new AppError('User not found', 401));
   }

   // 🔒 BLOCK BANNED USERS
   if (user.isBanned) {
      return next(new AppError('Account banned', 403));
   }

   req.dbUser = user; // attach fresh DB user
   next();
};

// =====================================
// 🎤 VERIFIED ARTIST ONLY
// =====================================
const requireVerifiedArtist = [
   attachFreshUser,
   (req, res, next) => {

      const user = req.dbUser;

      if (user.role !== 'artist') {
         return next(new AppError('Artist only', 403));
      }

      if (user.artistVerification.status !== 'approved') {
         return next(new AppError('Artist not approved', 403));
      }

      if (!user.artistVerification.isVerified) {
         return next(new AppError('Artist not verified', 403));
      }

      next();
   }
];

// =====================================
// 🛡 ADMIN ONLY
// =====================================
const requireAdmin = [
   attachFreshUser,
   (req, res, next) => {

      if (req.dbUser.role !== 'admin') {
         return next(new AppError('Admin only', 403));
      }

      next();
   }
];

// =====================================
// 👤 USER ONLY
// =====================================
const requireUser = [
   attachFreshUser,
   (req, res, next) => {

      if (req.dbUser.role !== 'user') {
         return next(new AppError('User only', 403));
      }

      next();
   }
];

module.exports = {
   requireVerifiedArtist,
   requireAdmin,
   requireUser
};