import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Import routes
import userRoutes from "./routes/user.routes.js";
import queryRoutes from "./routes/query.js";
import voiceRoutes from "./routes/voice.js";
import cropRoutes from "./routes/crop.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import cropSimChatRoutes from "./routes/cropSimChat.route.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.middleware.js";
import corsDebug from "./middleware/cors-debug.middleware.js";

const app = express();

/**
 * ULTRA-ROBUST CORS CONFIGURATION
 * This setup addresses the most common CORS issues with Digital Ocean deployments
 */

// CORS Configuration - Define allowed origins
const allowList = new Set([
  // Local development origins
  "http://localhost:3000",
  "http://127.0.0.1:3000", 
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  
  // Production frontend
  "https://fasalsetu.vercel.app",
]);

// Allow Vercel preview URLs and any additional domains from environment
const allowRegex = [
  /^https:\/\/.*\.vercel\.app$/,  // All Vercel preview domains
  /^https:\/\/.*-fasalsetu\.vercel\.app$/, // Vercel PR previews
];

// Environment-based configuration - Add production frontend URL if specified
if (process.env.FRONTEND_URL) {
  // Support multiple comma-separated URLs in the FRONTEND_URL
  const frontendUrls = process.env.FRONTEND_URL.split(',');
  frontendUrls.forEach(url => allowList.add(url.trim()));
}

// Add additional origins from environment variable
if (process.env.ADDITIONAL_CORS_ORIGINS) {
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS.split(',');
  additionalOrigins.forEach(origin => allowList.add(origin.trim()));
}

// If in development, add all origins for easier testing
if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_ALL_ORIGINS === 'true') {
  console.log('⚠️ DEVELOPMENT MODE: Allowing all origins for CORS');
  // Will be handled by setting origin: true below
}

console.log('✅ CORS Allowed Origins:', Array.from(allowList));
console.log('✅ CORS Allowed Regex Patterns:', allowRegex.map(r => r.toString()));

// Enable CORS debug logs in non-production or when explicitly enabled
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CORS === 'true') {
  app.use(corsDebug);
}

const corsOptions = {
  origin: process.env.ALLOW_ALL_ORIGINS === 'true' 
    ? true  // Allow all origins when flag is set (for debugging)
    : function(origin, callback) {
        // Allow requests with no origin (curl, Postman, mobile apps, etc)
        if (!origin) {
          return callback(null, true);
        }
        
        // Check against allowed list and regex patterns
        if (allowList.has(origin) || allowRegex.some(r => r.test(origin))) {
          return callback(null, true);
        }
        
        // Log blocked origins
        console.log(`⛔ CORS blocked origin: ${origin}`);
        return callback(new Error(`Not allowed by CORS: ${origin}`));
      },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With", 
    "Accept", 
    "Origin", 
    "Access-Control-Allow-Headers", 
    "Access-Control-Allow-Origin",
    "Cache-Control",
    "pragma",
    "sec-fetch-dest", 
    "sec-fetch-mode",
    "sec-fetch-site"
  ],
  exposedHeaders: ['Content-Length', 'Date'],
  maxAge: 86400, // 24 hours cache for preflight requests
  optionsSuccessStatus: 204,
};

// Add Vary header for all requests
app.use((req, res, next) => { 
  res.header("Vary", "Origin");
  next(); 
});

// Apply CORS middleware - MUST BE BEFORE ANY ROUTE HANDLERS
app.use(cors(corsOptions));

// Handle preflight requests explicitly for better reliability
app.options("*", cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api", chatRoutes);
app.use("/api", conversationRoutes);
app.use("/api/crop-sim", cropSimChatRoutes);

// Extended health check with CORS info
app.get("/health", (req, res) => {
  // Include useful diagnostics in health endpoint for debugging
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    environment: process.env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: Array.from(allowList),
      allowRegexPatterns: allowRegex.map(r => r.toString()),
      requestOrigin: req.headers.origin || 'none'
    }
  });
});

// Add special CORS debug route
app.get("/cors-debug", (req, res) => {
  res.status(200).json({
    message: "CORS Debug Information",
    headers: {
      received: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        userAgent: req.headers['user-agent'],
        forwarded: req.headers['x-forwarded-host'],
        forwardedProto: req.headers['x-forwarded-proto']
      },
      sent: {
        'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
        'access-control-allow-credentials': res.getHeader('access-control-allow-credentials'),
        'vary': res.getHeader('vary')
      }
    },
    environment: process.env.NODE_ENV,
    allowedOrigins: Array.from(allowList),
    requestMatched: !req.headers.origin || 
      allowList.has(req.headers.origin) || 
      allowRegex.some(r => r.test(req.headers.origin)),
    cookies: req.cookies ? Object.keys(req.cookies) : []
  });
});

// CORS-aware error handling middleware - using express error handler format
app.use((err, req, res, next) => {
  // Always ensure CORS headers are present in error responses
  const origin = req.headers.origin;
  if (origin) {
    if (allowList.has(origin) || allowRegex.some(r => r.test(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_ALL_ORIGINS === 'true') {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Vary", "Origin");
  }
  
  // Log error details
  console.error("Error encountered:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    origin: req.headers.origin || 'none'
  });
  
  // Special handling for CORS errors
  if (err.message && err.message.includes('Not allowed by CORS')) {
    return res.status(403).json({ 
      success: false,
      error: "CORS: Origin not allowed",
      message: `The origin '${origin}' is not allowed by CORS policy`,
      details: {
        requestOrigin: origin,
        allowedOrigins: Array.from(allowList),
        allowedPatterns: allowRegex.map(r => r.toString())
      },
      help: "If this is unexpected, please add this origin to the CORS allowlist"
    });
  }
  
  // Fall through to default error handler
  next(err);
});

// Default error handling middleware (must be last)
app.use(errorHandler);

export { app };