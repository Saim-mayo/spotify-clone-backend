const multer = require('multer');
const AppError = require('../utils/appError');

const errorHandler = (err, req, res, next) => {

   let statusCode = 500;
   let message = 'Internal Server Error';

   // =====================================
   // CUSTOM APPLICATION ERRORS
   // =====================================
   if (err instanceof AppError) {

      statusCode = err.statusCode;
      message = err.message;

      // Expected operational errors
      if (process.env.NODE_ENV !== 'production') {
         console.log(
            `⚠️ ${req.method} ${req.originalUrl} -> ${statusCode} ${message}`
         );
      }
   }

   // =====================================
   // MULTER ERRORS
   // =====================================
   else if (err instanceof multer.MulterError) {

      switch (err.code) {

         case 'LIMIT_FILE_SIZE':
            statusCode = 400;
            message = 'File size exceeds the maximum limit of 5 MB.';
            break;

         case 'LIMIT_UNEXPECTED_FILE':
            statusCode = 400;
            message = 'Only one music file is allowed.';
            break;

         case 'LIMIT_PART_COUNT':
            statusCode = 400;
            message = 'Too many form-data parts.';
            break;

         case 'LIMIT_FIELD_KEY':
            statusCode = 400;
            message = 'Field name is too long.';
            break;

         case 'LIMIT_FIELD_VALUE':
            statusCode = 400;
            message = 'Field value is too long.';
            break;

         case 'LIMIT_FIELD_COUNT':
            statusCode = 400;
            message = 'Too many fields were submitted.';
            break;

         default:
            statusCode = 400;
            message = err.message;
      }

      console.warn(`⚠️ Multer Error: ${message}`);
   }

   // =====================================
   // INVALID FILE TYPES
   // =====================================
   else if (
      err.message === 'Only audio files allowed' ||
      err.message === 'Only image files allowed'
   ) {

      statusCode = 400;
      message = err.message;

      console.warn(`⚠️ ${message}`);
   }

   // =====================================
   // INVALID OBJECT ID
   // =====================================
   else if (err.name === 'CastError') {

      statusCode = 400;
      message = 'Invalid ID format';

      console.warn(`⚠️ ${message}`);
   }

   // =====================================
   // DUPLICATE KEY
   // =====================================
   else if (err.code === 11000) {

      statusCode = 409;
      message = 'Duplicate entry found';

      console.warn(`⚠️ ${message}`);
   }

   // =====================================
   // JWT ERRORS
   // =====================================
   else if (err.name === 'JsonWebTokenError') {

      statusCode = 401;
      message = 'Invalid token';

      console.warn(`⚠️ ${message}`);
   }

   else if (err.name === 'TokenExpiredError') {

      statusCode = 401;
      message = 'Access token expired';

      console.warn(`⚠️ ${message}`);
   }

   // =====================================
   // UNKNOWN / UNEXPECTED ERRORS
   // =====================================
   else {

      console.error('🔥 Unexpected Error');
      console.error(err);

      if (process.env.NODE_ENV === 'production') {
         message = 'Something went wrong';
      }
      else {
         message = err.message || message;
      }
   }

   return res.status(statusCode).json({
      success: false,
      message
   });

};

module.exports = errorHandler;