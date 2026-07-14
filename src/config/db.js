const mongoose = require('mongoose');
const { loadPlanCache } = require('../services/planCache.service');

const connectDB = async () => {
   try {
      await mongoose.connect(process.env.MONGO_URI);

      console.log('✅ MongoDB Connected');

      // 💎 Load the Stripe-synced plan catalog into memory before the
      // app starts accepting traffic — see services/planCache.service.js.
      // On a brand new environment with no Plan documents yet, this
      // just loads an empty cache (run scripts/syncPlans.js to seed it)
      // rather than failing boot.
      await loadPlanCache();

      console.log('✅ Plan cache loaded');
   } catch (error) {
      console.error('❌ MongoDB Connection Failed');
      console.error(error.message);
      process.exit(1);
   }
};

module.exports = connectDB;