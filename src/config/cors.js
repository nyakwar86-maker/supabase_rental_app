// src/config/cors.js
const isProduction = process.env.NODE_ENV === 'production';

const getAllowedOrigins = () => {
  const origins = [];
  
  // Local development
  if (!isProduction) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:5000'
    );
  }
  
  // Production URLs from environment
  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN);
  }
  
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Allow all Vercel deployments in production
  if (isProduction) {
    origins.push(/\.vercel\.app$/);
  }
  
  return origins;
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

module.exports = { corsOptions, getAllowedOrigins };