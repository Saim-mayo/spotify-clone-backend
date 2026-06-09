require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
console.log("ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);


process.on('uncaughtException', (err) => {
   console.error('UNCAUGHT EXCEPTION:', err);
   process.exit(1);
});

process.on('unhandledRejection', (err) => {
   console.error('UNHANDLED REJECTION:', err);
   process.exit(1);
});

const startServer = async () => {
   try {
      await connectDB();

      const PORT = process.env.PORT || 3000;

      app.listen(PORT, () => {
         console.log(`🚀 Server running on port ${PORT}`);
      });

   } catch (error) {
      console.error("DB Connection Failed:", error);
      process.exit(1);
   }
};

startServer();