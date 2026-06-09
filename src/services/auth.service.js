const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const AppError = require('../utils/appError');
const jwt = require('jsonwebtoken');

const {
   generateAccessToken,
   generateRefreshToken
} = require('../utils/token');

const registerService = async ({ username, email, password, role }) => {

   const exists = await userModel.findOne({
      $or: [{ email }, { username }]
   });

   if (exists) throw new AppError('User already exists', 409);

   const hashedPassword = await bcrypt.hash(password, 10);

   const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      role
   });

   const accessToken = generateAccessToken(user);
   const refreshToken = generateRefreshToken(user);

   user.refreshToken = refreshToken;
   await user.save();

   return {
      accessToken,
      refreshToken,
      user: {
         id: user._id,
         username: user.username,
         email: user.email,
         role: user.role
      }
   };
};

const loginService = async ({ email, username, password }) => {

   const user = await userModel.findOne({
      $or: [{ email }, { username }]
   });

   if (!user) throw new AppError('Invalid credentials', 401);

   const match = await bcrypt.compare(password, user.password);

   if (!match) throw new AppError('Invalid credentials', 401);

   const accessToken = generateAccessToken(user);
   const refreshToken = generateRefreshToken(user);

   user.refreshToken = refreshToken;
   await user.save();

   return {
      accessToken,
      refreshToken,
      user: {
         id: user._id,
         username: user.username,
         email: user.email,
         role: user.role
      }
   };
};

module.exports = {
   registerService,
   loginService
};