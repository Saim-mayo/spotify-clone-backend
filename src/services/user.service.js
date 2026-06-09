const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const { uploadFile } = require('./storage.service');

/**
 * =========================
 * 👤 GET PROFILE
 * =========================
 */
const getMyProfileService = async (userId) => {

   const user = await userModel.findById(userId)
      .select('-password -refreshToken');

   if (!user) {
      throw new AppError('User not found', 404);
   }

   return user;
};

/**
 * =========================
 * ✏️ UPDATE PROFILE
 * =========================
 */
const updateMyProfileService = async (userId, data) => {

   const user = await userModel.findById(userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (data.username) user.username = data.username;
   if (data.bio) user.bio = data.bio;

   await user.save();

   return {
      username: user.username,
      bio: user.bio
   };
};

/**
 * =========================
 * 🖼️ UPLOAD AVATAR (FIXED)
 * =========================
 */
const uploadAvatarService = async (userId, file) => {

   if (!file || !file.buffer) {
      throw new AppError('Avatar file is required', 400);
   }

   const user = await userModel.findById(userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   let base64;

   try {
      base64 = file.buffer.toString('base64');
   } catch (err) {
      throw new AppError('File processing failed', 500);
   }

   const result = await uploadFile(base64, file.originalname);

   // safety check (important)
   if (!result?.url) {
      throw new AppError('Avatar upload failed', 500);
   }

   user.avatar = result.url;
   await user.save();

   return { avatar: user.avatar };
};

module.exports = {
   getMyProfileService,
   updateMyProfileService,
   uploadAvatarService
};