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
         required: true,
         index: true
      },

      status: {
         type: String,
         enum: ['processing', 'active', 'disabled'],
         default: 'active',
         index: true
      },

      visibility: {
         type: String,
         enum: ['public', 'private'],
         default: 'public',
         index: true
      },

      isDeleted: {
         type: Boolean,
         default: false,
         index: true
      },

      deletedAt: {
         type: Date,
         default: null
      },

      disabledReason: {
         type: String,
         default: ''
      }
   },
   { timestamps: true } // ✅ IMPORTANT for production sorting
);


// 🔥 INDEXES (PRODUCTION LEVEL)


// 2. Fast latest albums feed
albumSchema.index({ createdAt: -1 });
// 2. Fast fetch active albums
albumSchema.index({
   status: 1,
   visibility: 1,
   isDeleted: 1
});

// 3. Search albums by title (text search)
albumSchema.index({ title: "text" });

// 4. Optional: prevent duplicate album names per artist
albumSchema.index(
   { artist: 1, title: 1 },
   { unique: true }
);

const albumModel = mongoose.model('Album', albumSchema);

module.exports = albumModel;