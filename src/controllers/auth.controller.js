const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');

const {
   registerService,
   loginService
} = require('../services/auth.service');

const {
   generateAccessToken
} = require('../utils/token');


// ===================== REGISTER
const registerUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      throw new AppError('Validation error', 400);
   }

   const data = await registerService(req.body);

   // save refresh token in DB (IMPORTANT FIX)
   await userModel.findByIdAndUpdate(data.user.id, {
      refreshToken: data.refreshToken
   });

   res.cookie('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
   });

   res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
   });

   return res.status(201).json({
      message: 'User created',
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
   });
});


// ===================== LOGIN
const loginUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      throw new AppError('Validation error', 400);
   }

   const data = await loginService(req.body);

   // save refresh token in DB (IMPORTANT FIX)
   await userModel.findByIdAndUpdate(data.user.id, {
      refreshToken: data.refreshToken
   });

   res.cookie('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
   });

   res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
   });

   return res.status(200).json({
      message: 'Login successful',
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
   });
});


// ===================== REFRESH TOKEN
const refreshAccessToken = asyncHandler(async (req, res) => {

   const refreshToken = req.cookies.refreshToken;

   if (!refreshToken) {
      throw new AppError('Refresh token missing', 401);
   }

   const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
   );

   const user = await userModel.findById(decoded.userId);

   if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 403);
   }

   const newAccessToken = generateAccessToken(user);

   res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
   });

   return res.status(200).json({
      message: 'Token refreshed',
      accessToken: newAccessToken
   });
});


const logoutUser = asyncHandler(async (req, res) => {

   const refreshToken = req.cookies.refreshToken;

   if (refreshToken) {
      try {
         const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
         );

         await userModel.findByIdAndUpdate(decoded.userId, {
            refreshToken: null,
            tokenVersion: (user.tokenVersion || 0) + 1
         });

      } catch (err) {
         // ignore invalid token (still logout user)
      }
   }

   res.clearCookie('accessToken');
   res.clearCookie('refreshToken');

   return res.status(200).json({
      message: 'Logout successful'
   });
});

module.exports = {
   registerUser,
   loginUser,
   refreshAccessToken,
   logoutUser
};