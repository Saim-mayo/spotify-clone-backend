const AppError = require('../utils/appError');

const isArtist = (req, res, next) => {
   if (!req.user) return next(new AppError('Unauthorized', 401));
   if (req.user.role !== 'artist') return next(new AppError('Artist only', 403));
   next();
};

const isAdmin = (req, res, next) => {
   if (!req.user) return next(new AppError('Unauthorized', 401));
   if (req.user.role !== 'admin') return next(new AppError('Admin only', 403));
   next();
};

module.exports = { isArtist, isAdmin };