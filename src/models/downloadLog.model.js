const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema({

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

   ip: {
      type: String,
      default: ''
   },

   userAgent: {
      type: String,
      default: ''
   },

   downloadedAt: {
      type: Date,
      default: Date.now,
      index: true
   }

}, {
   timestamps: false
});

downloadLogSchema.index({
   user: 1,
   downloadedAt: -1
});

downloadLogSchema.index({
   song: 1,
   downloadedAt: -1
});

module.exports = mongoose.model(
   'DownloadLog',
   downloadLogSchema
);