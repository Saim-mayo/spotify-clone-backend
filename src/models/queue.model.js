const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
   user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
   },

   queue: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Music'
   }],

   isShuffle: {
      type: Boolean,
      default: false
   },

   repeatMode: {
      type: String,
      enum: ['off', 'one', 'all'],
      default: 'off'
   },

   currentIndex: {
      type: Number,
      default: 0
   }
}, { timestamps: true });

/**
 * INDEXES (ONLY HERE)
 */
queueSchema.index({ user: 1 });
queueSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('Queue', queueSchema);