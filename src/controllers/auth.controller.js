const asyncHandler = require("../utils/asyncHandler");
const { validationResult } = require("express-validator");

const userModel = require("../models/user.model");
const AppError = require("../utils/appError");

const {
   registerService,
   loginService
} = require("../services/auth.service");

const {
   generateAccessToken
} = require("../utils/token");

const {
   rotateToken,
   revokeFamily,
   createTokenFamily
} = require("../utils/tokenStore");
// ======================================================
// COOKIE OPTIONS
// ======================================================
const cookieOptions = {
   httpOnly: true,
   secure: process.env.NODE_ENV === 'production',
   sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
   maxAge: 7 * 24 * 60 * 60 * 1000,
   path: '/'
};

// ======================================================
// REGISTER
// ======================================================
const registerUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw new AppError('Validation error', 400);
   }

   // Prevent privilege escalation
   delete req.body.role;

   const data = await registerService(req.body);

   res.cookie('accessToken', data.accessToken, cookieOptions);
   res.cookie('refreshToken', data.refreshToken, cookieOptions);

   return res.status(201).json({
      success: true,
      message: 'User created',
      ...(process.env.NODE_ENV !== 'production' && {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }),
      // === FIX START: Removed accessToken and refreshToken from the JSON body ===
      user: {
         id: data.user.id,
         username: data.user.username,
         email: data.user.email,
         role: data.user.role,
         artistVerification: data.user.artistVerification
      }
      // === FIX END ===
   });

});

// ======================================================
// LOGIN
// ======================================================
const loginUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw new AppError('Validation error', 400);
   }

   const data = await loginService(req.body);

   res.cookie('accessToken', data.accessToken, cookieOptions);
   res.cookie('refreshToken', data.refreshToken, cookieOptions);

   return res.status(200).json({
      success: true,
      message: 'Login successful',
      ...(process.env.NODE_ENV !== 'production' && {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }),
      // === FIX START: Removed accessToken and refreshToken from the JSON body ===
      user: {
         id: data.user.id,
         username: data.user.username,
         email: data.user.email,
         role: data.user.role,
         artistVerification: data.user.artistVerification

      }
      // === FIX END ===
   });

});


// ======================================================
// REFRESH TOKEN
// ======================================================
// ======================================================
// REFRESH TOKEN (FIXED: PRIORITIZE COOKIES FIRST)
// ======================================================
const refreshAccessToken = asyncHandler(async (req, res) => {
   
   // === FIX START: Always prioritize secure automatic cookies over the request body ===
   let rawRefreshToken = req.cookies?.refreshToken;

   // Fallback to the body only if the cookie isn't present (e.g., non-browser/custom testing scripts)
   if (!rawRefreshToken) {
      rawRefreshToken = req.body?.refreshToken;
   }
   // === FIX END ===

   if (!rawRefreshToken) throw new AppError('Refresh token missing', 401);

   let newRaw, userId;

   try {
      ({ newRaw, userId } = await rotateToken(rawRefreshToken));
   } catch (err) {
      res.clearCookie('accessToken', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);

      if (err.message === 'TOKEN_REUSE') {
         throw new AppError('Security violation detected. Please login again.', 403);
      }
      if (err.message === 'TOKEN_EXPIRED') {
         throw new AppError('Session expired. Please login again.', 401);
      }
      throw new AppError('Invalid refresh token', 401);
   }

   const user = await userModel.findById(userId);
   if (!user) throw new AppError('User not found', 404);
   if (user.isBanned) throw new AppError('Account banned', 403);

   const newAccessToken = generateAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
   });

   res.cookie('accessToken', newAccessToken, cookieOptions);
   res.cookie('refreshToken', newRaw, cookieOptions);

   return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      ...(process.env.NODE_ENV !== 'production' && {
        accessToken: newAccessToken,
        refreshToken: newRaw,
      }),
   });
});

// ======================================================
// LOGOUT
// ======================================================
const logoutUser = asyncHandler(async (req, res) => {
   const rawToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken;
   if (rawToken) {
      await revokeFamily(rawToken).catch(() => { }); // best-effort
   }

   res.clearCookie('accessToken', cookieOptions);
   res.clearCookie('refreshToken', cookieOptions);

   return res.status(200).json({ success: true, message: 'Logout successful' });
});

// ======================================================
// GOOGLE LOGIN
// ======================================================
const googleLogin = asyncHandler(async (req, res) => {
   const user = req.user;
   if (!user) throw new AppError('Google authentication failed', 401);
   if (user.isBanned) throw new AppError('Account banned', 403);

   const { raw: refreshToken } = await createTokenFamily(user._id);

   const accessToken = generateAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
   });

   res.cookie('accessToken', accessToken, cookieOptions);
   res.cookie('refreshToken', refreshToken, cookieOptions);

return res.status(200).json({
   success: true,
   message: 'Google login successful',
   accessToken,
   refreshToken,
   user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
   }
});
});

module.exports = {
   registerUser,
   loginUser,
   refreshAccessToken,
   logoutUser,
   googleLogin
};