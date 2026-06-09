const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
   username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
   },

   email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
   },

   password: {
      type: String,
      required: true
   },
   refreshToken: {
      type: String,
      default: null
   },

   role: {
      type: String,
      enum: ['user', 'artist'],
      default: 'user',
      index: true
   },
   bio: {
      type: String,
      default: ''
   },

   avatar: {
      type: String,
      default: ''
   } 
}, { timestamps: true });



module.exports = mongoose.model('User', userSchema);