const AppError = require('../utils/appError');
const userModel = require('../models/user.model');
const { isEntitled, getPlanFeatures } = require('../utils/accessControl');

const checkDailyLimit = async (req, res, next) => {

   // Any active paid tier (basic/pro/max) bypasses the free daily limit
   const userDoc = req.userDoc || req.user;
   const sub = userDoc?.subscription;

   if (sub?.plan !== 'free' && isEntitled(sub)) {
      return next();
   }

   const user = await userModel.findById(req.user.userId);

   if (!user) {
      return next(new AppError('User not found', 404));
   }

   const today = new Date().toISOString().split('T')[0];

   // Reset counter when the day changes
   if (
      !user.dailyUsage ||
      user.dailyUsage.date !== today
   ) {
      user.dailyUsage = {
         date: today,
         plays: 0
      };
   }

   const { dailyPlayLimit } = getPlanFeatures(user);

   // null = unlimited for this plan; paid plans already bypass above,
   // this stays as a safe fallback if config ever changes.
   if (dailyPlayLimit !== null && user.dailyUsage.plays >= dailyPlayLimit) {
      return next(new AppError('Daily limit reached', 403));
   }

   user.dailyUsage.plays += 1;

   await user.save();

   req.userDoc = user;
   req.dbUser = user;

   next();
};

module.exports = {
   checkDailyLimit
};