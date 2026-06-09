const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');
const {
   getMyProfileService,
   updateMyProfileService,
   uploadAvatarService
} = require('../services/user.service');

// 👤 GET PROFILE
const getMyProfile = asyncHandler(async (req, res) => {

   const user = await getMyProfileService(req.user.userId);

   return res.status(200).json({
      user
   });
});

// ✏️ UPDATE PROFILE
const updateMyProfile = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const updated = await updateMyProfileService(
      req.user.userId,
      req.body
   );

   return res.status(200).json({
      message: 'Profile updated successfully',
      updated
   });
});

// 🖼️ UPLOAD AVATAR
const uploadAvatar = asyncHandler(async (req, res) => {

   const result = await uploadAvatarService(
      req.user.userId,
      req.file
   );

   return res.status(200).json({
      message: 'Avatar uploaded successfully',
      ...result
   });
});

module.exports = {
   getMyProfile,
   updateMyProfile,
   uploadAvatar
};