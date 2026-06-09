const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logger = require('./middlewares/logger.middleware');
const errorHandler = require('./middlewares/error.middleware');

const routes = require('./routes/index.routes');

const app = express();

// =====================
// CORE MIDDLEWARES
// =====================
app.use(express.json());
app.use(cookieParser());
app.use(logger);

// =====================
// SECURITY
// =====================
app.use(helmet());

// Hardcode a local fallback ONLY for safety during development
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ 
   origin: allowedOrigin, 
   credentials: true 
}));
// =====================
// RATE LIMITING (ANTI SPAM)
// =====================
const limiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   max: 100,
   message: "Too many requests, try again later"
});

app.use(limiter);

// =====================
// ROUTES
// =====================
app.use('/api', routes);

// =====================
// GLOBAL ERROR HANDLER (LAST)
// =====================
app.use(errorHandler);

module.exports = app;