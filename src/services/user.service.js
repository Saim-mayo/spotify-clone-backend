const bcrypt = require('bcrypt');

const userModel = require('../models/user.model');

const AppError = require('../utils/appError');

const { uploadFile } = require('./storage.service');

const { getPlanFeatures } = require('../utils/accessControl');

const Download = require('../models/download.model');


// =====================================
// GET PROFILE
// =====================================

const getMyProfileService = async (userId) => {

   const user = await userModel
      .findById(userId)
      .select('-password -refreshToken');

   if (!user) {

      throw new AppError(
         'User not found',
         404
      );

   }

   return user;
};


// =====================================
// UPDATE PROFILE
// =====================================

const updateMyProfileService = async (

   userId,

   data

) => {

   const user = await userModel.findById(
      userId
   );

   if (!user) {

      throw new AppError(
         'User not found',
         404
      );

   }

   // ==========================
   // USERNAME UPDATE
   // ==========================

   if (data.username) {

      const username =
         data.username.trim();

      const existingUser =
         await userModel.findOne({

            username,

            _id: { $ne: userId }

         });

      if (existingUser) {

         throw new AppError(

            'Username already taken',

            409

         );

      }

      user.username = username;

   }

   // ==========================
   // BIO UPDATE
   // ==========================

   if (typeof data.bio === 'string') {

      user.bio =
         data.bio.trim();

   }

   await user.save();

   return {

      username:
         user.username,

      bio:
         user.bio,

      avatar:
         user.avatar

   };

};

// =====================================
// UPLOAD AVATAR
// =====================================

const uploadAvatarService = async (

   userId,

   file

) => {

   if (!file || !file.buffer) {

      throw new AppError(

         'Avatar file is required',

         400

      );

   }

   const user = await userModel.findById(
      userId
   );

   if (!user) {

      throw new AppError(
         'User not found',
         404
      );

   }

   const result = await uploadFile(

      file.buffer,

      file.originalname,

      'ytmusic-clone/avatars'

   );

   if (!result?.url) {

      throw new AppError(

         'Avatar upload failed',

         500

      );

   }

   user.avatar = result.url;

   await user.save();

   return {

      avatar:
         user.avatar

   };

};


// =====================================
// SET PASSWORD
// =====================================

const setPasswordService = async (

   userId,

   password

) => {

   const user = await userModel.findById(
      userId
   );

   if (!user) {

      throw new AppError(
         'User not found',
         404
      );

   }

   // =====================================
   // PASSWORD ALREADY EXISTS
   // =====================================

   if (user.password) {

      throw new AppError(

         'Password already exists',

         400

      );

   }

   const hashedPassword =

      await bcrypt.hash(

         password,

         10

      );

   user.password =
      hashedPassword;

   await user.save();

   return {

      success: true

   };

};

// =====================================
// GET FEATURE FLAGS (ads / downloads / play limit)
// =====================================
const getMyFeatureFlagsService = async (user) => {

   const features = getPlanFeatures(user);

   let downloadsUsed = 0;

   if (features.maxDownloads !== null) {
      downloadsUsed = await Download.countDocuments({ user: user.userId });
   }

   return {
      plan: user.subscription.plan,
      showAds: !features.adFree,
      canDownload: features.canDownload,
      maxDownloads: features.maxDownloads,          // null = unlimited
      downloadsUsed,
      downloadsRemaining: features.maxDownloads === null
         ? null
         : Math.max(features.maxDownloads - downloadsUsed, 0),
      dailyPlayLimit: features.dailyPlayLimit        // null = unlimited
   };
};

module.exports = {

   getMyProfileService,

   updateMyProfileService,

   uploadAvatarService,

   setPasswordService,

   getMyFeatureFlagsService

};