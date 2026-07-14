// scripts/seedAdmin.js

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ✅ use your existing model
const User = require('../src/models/user.model');

// ✅ OPTIONAL: reuse your DB connection (cleaner)
// const connectDB = require('../src/config/db');

async function seedAdmin() {
   try {
      // ===============================
      // 🔒 SAFETY 1: BLOCK IN PRODUCTION
      // ===============================
      if (process.env.NODE_ENV === 'production') {
         throw new Error('Seeding disabled in production');
      }

      // ===============================
      // 🔌 CONNECT DB
      // ===============================
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB Connected');

      // ===============================
      // 🔒 SAFETY 2: CHECK EXISTING ADMIN
      // ===============================
      const existingAdmin = await User.findOne({ role: 'admin' });

      if (existingAdmin) {
         console.log('⚠️ Admin already exists. Exiting...');
         process.exit(0);
      }

      // ===============================
      // 🔒 SAFETY 3: ENV VALIDATION
      // ===============================
      const email = process.env.ADMIN_SEED_EMAIL;
      const password = process.env.ADMIN_SEED_PASSWORD;

      if (!email || !password) {
         throw new Error('Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD');
      }

      // ===============================
      // 🔒 NORMALIZE EMAIL
      // ===============================
      const normalizedEmail = email.toLowerCase().trim();

      // ===============================
      // 🔒 EXTRA GUARD: DUPLICATE EMAIL
      // ===============================
      const existingUser = await User.findOne({ email: normalizedEmail });

      if (existingUser) {
         throw new Error('User with this email already exists');
      }

      // ===============================
      // 🔐 HASH PASSWORD
      // ===============================
      const hashedPassword = await bcrypt.hash(password, 12);

      // ===============================
      // 👤 CREATE ADMIN
      // ===============================
      const admin = await User.create({
         username: 'admin',
         email: normalizedEmail,
         password: hashedPassword,
         role: 'admin'
      });

      console.log('🎉 Admin created successfully');
      console.log(`📧 Email: ${admin.email}`);

      process.exit(0);

   } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
   }
}

seedAdmin();