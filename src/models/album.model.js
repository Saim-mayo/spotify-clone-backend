const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema(
   {
      title: { type: String, required: true },

      musics: [
         {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Music'
         }
      ],

      artist: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true
      }
   },
   { timestamps: true } // ✅ IMPORTANT for production sorting
);


// 🔥 INDEXES (PRODUCTION LEVEL)

// 1. Fast fetch albums by artist
albumSchema.index({ artist: 1 });

// 2. Fast latest albums feed
albumSchema.index({ createdAt: -1 });

// 3. Search albums by title (text search)
albumSchema.index({ title: "text" });

// 4. Optional: prevent duplicate album names per artist
albumSchema.index(
   { artist: 1, title: 1 },
   { unique: true }
);

const albumModel = mongoose.model('Album', albumSchema);

module.exports = albumModel;