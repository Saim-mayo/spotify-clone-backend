
const isArtist = (req, res, next) => {
   if (!req.user) {
      return res.status(401).json({
         success: false,
         message: 'Unauthorized'
      });
   }

   if (req.user.role !== 'artist') {
      return res.status(403).json({
         success: false,
         message: 'Forbidden: Artist access only'
      });
   }

   next();
};

module.exports = { isArtist };