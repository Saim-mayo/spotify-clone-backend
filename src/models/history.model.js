const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
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
      },

      playedAt: {
         type: Date,
         default: Date.now
      }
   },
   { timestamps: true }
);


// 🔥 INDEXES (PRODUCTION LEVEL)

// 1. Fast user history lookup (MOST IMPORTANT)
historySchema.index({ user: 1, playedAt: -1 });

// 2. Fast analytics per song (who played this song)
historySchema.index({ song: 1 });

// 3. Optional: prevent duplicate rapid history spam (same user + song)
historySchema.index({ user: 1, song: 1, playedAt: -1 });

const HistoryModel = mongoose.model('History', historySchema);

module.exports = HistoryModel;