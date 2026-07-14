const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const RefreshToken = require('../models/refreshToken');

// =====================================
// 👤 GET PENDING ARTISTS
// =====================================
const getPendingArtists = asyncHandler(async (req, res) => {

   // =====================================
   // Pagination
   // =====================================
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);

   const filter = {
      role: 'user',
      'artistVerification.status': 'pending'
   };

   const [artists, total] = await Promise.all([
      userModel
         .find(filter)
         .select('-password')
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),

      userModel.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      artists
   });

});

// =====================================
// ✅ APPROVE ARTIST
// =====================================
const approveArtist = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Cannot approve banned user', 403);
   }

   if (user.artistVerification.status !== 'pending') {
      throw new AppError('Artist request not pending', 400);
   }

   // =====================================
   // Promote user to artist
   // =====================================
   user.role = 'artist';
   user.artistVerification.status = 'approved';
   user.artistVerification.isVerified = true;

   // Force logout on every device
   user.tokenVersion += 1;

   await user.save();

   // Remove refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   return res.status(200).json({
      success: true,
      message: 'Artist approved successfully'
   });

});

// =====================================
// ❌ REJECT ARTIST
// =====================================
const rejectArtist = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.artistVerification.status !== 'pending') {
      throw new AppError('Artist request not pending', 400);
   }

   user.role = 'user';
   user.artistVerification.status = 'rejected';
   user.artistVerification.isVerified = false;

   // Logout all devices
   user.tokenVersion += 1;

   await user.save();

   // Remove refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   return res.status(200).json({
      success: true,
      message: 'Artist rejected'
   });

});

// =====================================
// 🚫 BAN USER
// =====================================
const banUser = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   // =====================================
   // Prevent admin banning himself
   // =====================================
   if (req.params.userId === req.user.userId.toString()) {
      throw new AppError('Cannot ban your own account', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   // =====================================
   // NEW FIX
   // Prevent banning already banned user
   // =====================================
   if (user.isBanned) {
      throw new AppError('User is already banned', 409);
   }

   user.isBanned = true;

   // Invalidate all JWTs
   user.tokenVersion += 1;

   await user.save();

   // Delete refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   return res.status(200).json({
      success: true,
      message: 'User banned successfully'
   });

});

// =====================================
// ✅ UNBAN USER
// =====================================
const unbanUser = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   // =====================================
   // NEW FIX
   // Prevent unbanning an already active user
   // =====================================
   if (!user.isBanned) {
      throw new AppError('User is not banned', 409);
   }

   user.isBanned = false;

   // Invalidate all JWTs
   user.tokenVersion += 1;

   await user.save();

   // Delete refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   return res.status(200).json({
      success: true,
      message: 'User unbanned successfully'
   });

});

module.exports = {
   getPendingArtists,
   approveArtist,
   rejectArtist,
   banUser,
   unbanUser
};