require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

process.on('uncaughtException', (err) => {
   console.error('UNCAUGHT EXCEPTION:', err);
   process.exit(1);
});

process.on('unhandledRejection', (err) => {
   console.error('UNHANDLED REJECTION:', err);
   process.exit(1);
});

const startServer = async () => {
   await connectDB();

   const PORT = process.env.PORT || 3000;

   app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
   });
};

startServer();