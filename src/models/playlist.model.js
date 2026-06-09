const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
{
    title: {
        type: String,
        required: true,
        trim: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    songs: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Music'
        }
    ],

    isPublic: {
        type: Boolean,
        default: true,
        index: true
    }
},
{
    timestamps: true
});

/**
 * =========================
 * 📌 INDEXES (FIXED + SAFE)
 * =========================
 */

// fast user playlists
playlistSchema.index({ user: 1, createdAt: -1 });

// public discovery
playlistSchema.index({ isPublic: 1, createdAt: -1 });

// text search
playlistSchema.index({ title: 'text' });

// 🚨 IMPORTANT FIX:
// prevent duplicate playlist title per user (REAL FIX)
playlistSchema.index(
    { user: 1, title: 1 },
    { unique: true }
);

module.exports = mongoose.model('Playlist', playlistSchema);