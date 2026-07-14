const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Music',
        required: true,
        index: true
    },

    downloadedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    ipAddress: {
        type: String,
        default: ''
    },

    userAgent: {
        type: String,
        default: ''
    },
    downloadCount: {
        type: Number,
        default: 1
    }

}, { timestamps: true });

downloadSchema.index({
    user: 1,
    song: 1,
    downloadedAt: -1
});

module.exports = mongoose.model('Download', downloadSchema);