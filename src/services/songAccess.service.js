const Music = require("../models/music.model");
const AppError = require("../utils/appError");
const { getEffectiveLevel } = require("../utils/accessControl");
const { MIN_PAID_LEVEL } = require("../config/plans");

/**
 * ====================================================
 * CENTRAL SONG AUTHORIZATION SERVICE
 * ====================================================
 * This is the ONLY place that decides whether a user
 * can access a song.
 *
 * Controllers should NEVER perform permission checks.
 * ====================================================
 */

const getAuthorizedSong = async (
   songId,
   user,
   {
      requireDownload = false
   } = {}
) => {

   const song = await Music.findById(songId);

   if (!song) {
      throw new AppError("Song not found", 404);
   }

   // ----------------------------------
   // Soft Deleted
   // ----------------------------------
   if (song.isDeleted) {
      throw new AppError("Song has been removed", 404);
   }

   // ----------------------------------
   // Disabled by Admin
   // ----------------------------------
   if (song.status !== "active") {
      throw new AppError(
         "Song is currently unavailable",
         403
      );
   }

   // ----------------------------------
   // Upload Still Processing
   // ----------------------------------
   if (!song.processingFinished) {
      throw new AppError(
         "Song is still processing",
         409
      );
   }

   // ----------------------------------
   // Private Songs
   // ----------------------------------
   const owner =
      song.artist.toString() ===
      user.userId.toString();

   if (
      song.visibility === "private" &&
      !owner
   ) {
      throw new AppError(
         "Private song",
         403
      );
   }

   // ----------------------------------
   // Premium Songs
   // ----------------------------------
   if (
      song.premiumOnly &&
      !owner
   ) {

      if (getEffectiveLevel(user) < MIN_PAID_LEVEL) {

         throw new AppError(
            "A paid plan is required",
            403
         );

      }

   }

   // ----------------------------------
   // Download Disabled
   // ----------------------------------
   if (
      requireDownload &&
      !song.allowDownload &&
      !owner
   ) {

      throw new AppError(
         "Downloads disabled for this song",
         403
      );

   }

   return song;

};

module.exports = {
   getAuthorizedSong
};