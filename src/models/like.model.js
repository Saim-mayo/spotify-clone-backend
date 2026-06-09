const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
   {
      user: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true
      },

      song: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Music',
         required: true
      }
   },
   { timestamps: true }
);


// 🔥 CORE INDEX (YOU ALREADY HAD THIS - PERFECT)

// prevents duplicate likes (CRITICAL)
likeSchema.index(
   { user: 1, song: 1 },
   { unique: true }
);


// 🔥 PRODUCTION ADDITIONS

// 1. Fast lookup of likes per song (used in trending)
likeSchema.index({ song: 1 });

// 2. Fast lookup of user's liked songs
likeSchema.index({ user: 1 });

// 3. Optional analytics sorting (rare but useful)
likeSchema.index({ createdAt: -1 });

const LikeModel = mongoose.model('Like', likeSchema);

module.exports = LikeModel;