const mongoose = require('mongoose');

const  musicSchema = new mongoose.Schema({
   uri: {
      type: String,
      required: true
   },

   title: {
      type: String,
      required: true
   },

   artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
   },

   playCount: {
      type: Number,
      default: 0,
      index: true
   }
}, { timestamps: true });

/**
 * 📌 INDEXES (PRODUCTION OPTIMIZATION)
 */

// 1. Fast search by song title
musicSchema.index({ title: 'text' });

// 2. Fast "artist's songs" fetch + sorting by newest
musicSchema.index({ artist: 1, createdAt: -1 });

// 3. Trending songs (most played)
musicSchema.index({ playCount: -1 });

module.exports = mongoose.model('Music', musicSchema);