const DownloadLog = require('../models/downloadLog.model');

const logDownload = async (req, res, next) => {

   try {

      await DownloadLog.create({

         user: req.user.userId,

         song: req.song._id,

         ip:
            req.ip ||

            req.headers['x-forwarded-for'] ||

            '',

         userAgent:
            req.headers['user-agent'] || ''

      });

      next();

   } catch (err) {

      next(err);

   }

};

module.exports = {
   logDownload
};