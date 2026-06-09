const jwt = require('jsonwebtoken');

/**
 * AUTH MIDDLEWARE (FIXED VERSION)
 * --------------------------------
 * WHY THIS CHANGE:
 * 1. Removed req.body token (security risk → anyone can fake token)
 * 2. Clean priority order (cookie → header only)
 * 3. Removed duplicate/buggy line
 * 4. Safer and production standard approach
 */

const authMiddleware = (req, res, next) => {
   try {

      // STEP 1: Get token from cookie OR header only
      const token =
         req.cookies?.accessToken ||
         req.headers.authorization?.split(' ')[1];

      // STEP 2: If no token → unauthorized
      if (!token) {
         return res.status(401).json({
            message: 'Unauthorized - No token provided'
         });
         
      }

      // STEP 3: verify token
      const decoded = jwt.verify(
         token,
         process.env.JWT_ACCESS_SECRET
      );

      // STEP 4: attach user to request
      req.user = decoded;

      next();

   } catch (err) {
      return res.status(401).json({
         message: 'Invalid or expired token'
      });
   }
};

module.exports = authMiddleware;