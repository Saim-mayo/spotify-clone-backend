const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./middlewares/logger.middleware');
const errorHandler = require('./middlewares/error.middleware');
const routes = require('./routes/index.routes');
const webhookRoutes = require('./routes/webhook.routes');
const passport = require('passport');
require('./config/passport');
const app = express();
app.set('trust proxy', 1);
app.use('/api/webhook', webhookRoutes);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use(logger);


app.use(helmet());

const allowedOrigins =
   process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173'];

app.use(
   cors({
      origin: allowedOrigins,
      credentials: true
   })
);


if (process.env.NODE_ENV === 'production') {
   app.use(
      rateLimit({
         windowMs: 15 * 60 * 1000,
         max: 100,
         message: 'Too many requests from this IP, please try again later.',
         standardHeaders: true,
         legacyHeaders: false
      })
   );
}


app.get('/health', (req, res) => {
   res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
   });
});


app.use('/api', routes);


app.use(errorHandler);

module.exports = app;