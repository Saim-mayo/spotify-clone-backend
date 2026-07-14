const AppError = require('../utils/appError');
const musicModel = require('../models/music.model');
const { getEffectiveLevel } = require('../utils/accessControl');
const { MIN_PAID_LEVEL } = require('../config/plans');

const verifyMediaAccess = (mode = 'stream') => {

   return async (req, res, next) => {

      // ==========================================
      // Load Song
      // ==========================================
      const song = await musicModel.findById(req.params.songId);

      if (!song) {
         return next(new AppError('Song not found', 404));
      }

      // ==================================================
      // ************** MA-01 FIX START ********************
      //
      // Authentication middleware now provides:
      //
      // req.userDoc
      // req.dbUser
      //
      // We support both to avoid future breakage.
      // ==================================================

      const user = req.userDoc || req.dbUser;

      if (!user) {
         return next(
            new AppError(
               'User context missing. Verify middleware execution order.',
               500
            )
         );
      }

      // ************** MA-01 FIX END **********************

      // ==========================================
      // Soft Delete
      // ==========================================
      if (song.deletedAt) {
         return next(new AppError('Song not found', 404));
      }

      // ==========================================
      // Song Status
      // ==========================================
      if (song.status !== 'active') {
         return next(new AppError('Song unavailable', 403));
      }

      // ==========================================
      // Processing
      // ==========================================
      if (!song.processingFinished) {
         return next(new AppError('Song still processing', 409));
      }

      // ==========================================
      // Private Songs
      // ==========================================
      if (
         song.visibility === 'private' &&
         song.artist.toString() !== user._id.toString()
      ) {
         return next(new AppError('Unauthorized', 403));
      }

      // ==========================================
      // Premium Songs
      // ==========================================
      if (song.premiumOnly) {

         const hasPaidPlan =
            getEffectiveLevel(user) >= MIN_PAID_LEVEL;

         if (!hasPaidPlan) {
            return next(new AppError('A paid plan is required', 403));
         }

      }

      // ==========================================
      // Download Disabled
      // ==========================================
      if (
         mode === 'download' &&
         !song.allowDownload
      ) {
         return next(new AppError('Downloads disabled', 403));
      }

      // ==========================================
      // Attach Song
      // ==========================================
      req.song = song;

      // Preserve compatibility
      req.dbUser = user;

      next();

   };

};

module.exports = {
   verifyMediaAccess
};