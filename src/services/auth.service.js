const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const AppError = require('../utils/appError');
const { generateAccessToken } = require('../utils/token');
const { createTokenFamily } = require('../utils/tokenStore');

const normalize = (value) => value?.trim().toLowerCase();

// ======================================================
// REGISTER SERVICE
// ======================================================
const registerService = async ({ username, email, password }) => {
  email = normalize(email);
  username = username?.trim();

  const exists = await userModel.findOne({ $or: [{ email }, { username }] });
  if (exists) throw new AppError('User already exists', 409);

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await userModel.create({ username, email, password: hashedPassword, role: 'user' });

  const { raw: refreshToken } = await createTokenFamily(user._id);

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return { accessToken, refreshToken, user };
};

// ======================================================
// LOGIN SERVICE (OPTIMIZED: NO EXTRA FINDBYIDANDUPDATE)
// ======================================================
const loginService = async ({ email, username, password }) => {
  if (!email && !username) throw new AppError('Email or username required', 400);

  email = normalize(email);
  const user = await userModel.findOne({ $or: [{ email }, { username }] });

  if (!user) throw new AppError('Invalid credentials', 401);
  if (user.isBanned) throw new AppError('Account is banned', 403);
  if (!user.password) throw new AppError('Please login using Google', 400);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError('Invalid credentials', 401);

  // New login = new token family (old family tokens become orphaned)
  const { raw: refreshToken } = await createTokenFamily(user._id);

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // === OPTIMIZATION: Mutating in-memory document saves an extra database round-trip ===
  user.lastLoginAt = new Date();
  await user.save();

  return { accessToken, refreshToken, user };
};

module.exports = { registerService, loginService };