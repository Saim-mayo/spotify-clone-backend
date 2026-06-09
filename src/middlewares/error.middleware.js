const AppError = require('../utils/appError');

const errorHandler = (err, req, res, next) => {

   console.error("🔥 ERROR:", err);

   // default values
   let statusCode = 500;
   let message = "Internal Server Error";

   // handle AppError (trusted errors)
   if (err instanceof AppError) {
      statusCode = err.statusCode;
      message = err.message;
   }

   // Mongoose bad ObjectId
   else if (err.name === "CastError") {
      statusCode = 400;
      message = "Invalid ID format";
   }

   // Duplicate key
   else if (err.code === 11000) {
      statusCode = 409;
      message = "Duplicate entry found";
   }

   // JWT errors
   else if (err.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid token";
   }

   else if (err.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Token expired";
   }

   // production safety
   if (process.env.NODE_ENV === "production" && !(err instanceof AppError)) {
      message = "Something went wrong";
   }

   return res.status(statusCode).json({
      message
   });
};

module.exports = errorHandler;