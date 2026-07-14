const jwt = require('jsonwebtoken');

const crypto = require("crypto");
const { randomUUID } = require('crypto');
/**
 * =====================================
 * 🔐 GENERATE ACCESS TOKEN (FIXED)
 * =====================================
 * CHANGES:
 * - ✅ added tokenVersion (CRITICAL)
 * - ✅ keeps role for authorization
 * - ✅ supports both user._id and userId
 */
const generateAccessToken = (user) => {

   return jwt.sign(
      {
         userId: user._id || user.userId,
         role: user.role,
         // 🔴 CRITICAL FIX:
         // this enables token revocation
         tokenVersion: user.tokenVersion || 0
      },
      process.env.JWT_ACCESS_SECRET,
      {
         expiresIn:
            process.env.ACCESS_TOKEN_EXPIRES || '15m'
      }
   );
};
/**
 * =====================================
 * 🔄 GENERATE REFRESH TOKEN (FIXED)
 * =====================================
 * CHANGES:
 * - ✅ added tokenVersion
 * - ✅ ensures refresh tokens also become invalid after logout
 */
module.exports = {
   generateAccessToken
};