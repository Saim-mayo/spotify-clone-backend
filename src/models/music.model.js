const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({

  

   fileId: {
      type: String,
      required: true
   },

   filePath: {
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
   status: {
      type: String,
      enum: [
         'processing',
         'active',
         'disabled'
      ],
      default: 'processing',
      index: true
   },

   playCount: {
      type: Number,
      default: 0,
      index: true
   },
   visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
      index: true
   },
   premiumOnly: {
      type: Boolean,
      default: false,
      index: true
   },
   allowDownload: {
      type: Boolean,
      default: true
   },
   isDeleted: {
      type: Boolean,
      default: false,
      index: true
   },
   processingFinished: {
      type: Boolean,
      default: true
   },
   disabledReason: {
      type: String,
      default: ''
   },

   deletedAt: {
      type: Date,
      default: null
   },

}, { timestamps: true });

musicSchema.index({ title: 'text' });
musicSchema.index({ artist: 1, createdAt: -1 });
musicSchema.index({ playCount: -1 });
musicSchema.index({
   status: 1,
   visibility: 1,
   isDeleted: 1
});

musicSchema.index({
   artist: 1,
   status: 1
});

module.exports = mongoose.model('Music', musicSchema);