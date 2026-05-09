

require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { testConnection } = require('./config/database'); // Import database test

const PORT = process.env.PORT || 5000; // Changed default to match your .env

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
  const origins = [];
  
  // Local development origins
  if (!isProduction) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:5000'
    );
  }
  
  // Production origins from environment
  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN);
  }
  
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Common Vercel preview URLs pattern (allow all Vercel previews)
  if (isProduction) {
    origins.push(/\.vercel\.app$/); // Allow all Vercel preview deployments
  }
  
  return origins;
};

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with production-ready CORS
const io = socketIO(server, {
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  path: '/socket.io/',
  // Production optimizations
  transports: isProduction ? ['websocket', 'polling'] : ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      console.log('❌ Socket auth: No token provided');
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    socket.userEmail = decoded.email;
    socket.userName = decoded.name || decoded.email; // Add user name if available
    
    console.log(`✅ Socket authenticated: ${socket.userId} (${socket.userEmail})`);
    next();
  } catch (error) {
    console.error('❌ Socket auth error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userId} (${socket.userEmail})`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Track typing states
  const typingStates = new Map();
  
  // Join conversation room
  socket.on('join_conversation', ({ conversationId }) => {
    if (!conversationId) {
      console.log(`❌ User ${socket.userId} attempted to join invalid conversation`);
      return;
    }
    
    socket.join(`conversation_${conversationId}`);
    console.log(`👥 User ${socket.userId} joined conversation ${conversationId}`);
    
    // Notify others in the conversation
    socket.to(`conversation_${conversationId}`).emit('user_joined', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      userName: socket.userName,
      timestamp: new Date().toISOString()
    });
  });
  
  // Leave conversation room
  socket.on('leave_conversation', ({ conversationId }) => {
    if (!conversationId) return;
    
    socket.leave(`conversation_${conversationId}`);
    console.log(`👋 User ${socket.userId} left conversation ${conversationId}`);
    
    // Clear typing state when leaving
    typingStates.delete(conversationId);
    
    // Notify others
    socket.to(`conversation_${conversationId}`).emit('user_left', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      timestamp: new Date().toISOString()
    });
  });
  
  // Typing indicator handler
  socket.on('typing', ({ conversationId, isTyping }) => {
    if (!conversationId) return;
    
    // Update typing state
    typingStates.set(conversationId, isTyping);
    
    // Broadcast immediately to conversation room
    socket.to(`conversation_${conversationId}`).emit('typing', {
      conversationId,
      userId: socket.userId,
      userEmail: socket.userEmail,
      userName: socket.userName,
      isTyping,
      timestamp: Date.now()
    });
    
    console.log(`✍️ User ${socket.userId} ${isTyping ? 'started' : 'stopped'} typing in conversation ${conversationId}`);
    
    // Auto-clear typing after 2 seconds if user doesn't send another typing event
    if (isTyping) {
      // Clear any existing timeout
      const existingTimeout = socket.typingTimeouts?.[conversationId];
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set new timeout
      socket.typingTimeouts = socket.typingTimeouts || {};
      socket.typingTimeouts[conversationId] = setTimeout(() => {
        if (typingStates.get(conversationId) === true) {
          socket.to(`conversation_${conversationId}`).emit('typing', {
            conversationId,
            userId: socket.userId,
            userEmail: socket.userEmail,
            userName: socket.userName,
            isTyping: false,
            timestamp: Date.now()
          });
          typingStates.delete(conversationId);
          console.log(`⏰ Auto-cleared typing for user ${socket.userId} in conversation ${conversationId}`);
        }
      }, 2000);
    }
  });
  
  // Handle new message (broadcast to conversation)
  socket.on('new_message', (messageData) => {
    const { conversationId, message } = messageData;
    
    if (!conversationId || !message) return;
    
    console.log(`💬 New message from ${socket.userId} in conversation ${conversationId}`);
    
    // Broadcast to everyone in the conversation including sender
    io.to(`conversation_${conversationId}`).emit('message_received', {
      ...messageData,
      userId: socket.userId,
      userEmail: socket.userEmail,
      userName: socket.userName,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`🔌 User disconnected: ${socket.userId} - Reason: ${reason}`);
    
    // Clear all typing timeouts
    if (socket.typingTimeouts) {
      Object.values(socket.typingTimeouts).forEach(timeout => {
        clearTimeout(timeout);
      });
    }
    
    // Notify conversations that user left
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room.startsWith('conversation_')) {
        socket.to(room).emit('user_disconnected', {
          userId: socket.userId,
          userEmail: socket.userEmail,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for user ${socket.userId}:`, error.message);
  });
});

// Make io available to all routes/controllers
app.set('io', io);

// Error handling for Socket.io
io.engine.on("connection_error", (err) => {
  console.error('❌ Socket.io connection error:', {
    code: err.code,
    message: err.message,
    context: err.context
  });
});

// Health check endpoint data (if your app doesn't have one)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'configured',
    websocket: io.engine.clientsCount > 0 ? 'active' : 'ready'
  });
});

// Start server function with database check
const startServer = async () => {
  console.log('='.repeat(50));
  console.log('🚀 Starting server initialization...');
  console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  
  // Test database connection
  console.log('\n📊 Testing database connection...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('\n❌ Cannot start server: Database connection failed');
    if (isProduction) {
      console.error('💀 Exiting due to database connection failure in production');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode without database...');
    }
  } else {
    console.log('✅ Database connection successful');
  }
  
  // Start server
  server.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Server started successfully! on ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 HTTP: ${isProduction ? `https://` : `http://localhost:`}${PORT}`);
    console.log(`🔌 WebSocket: ${isProduction ? `wss://` : `ws://localhost:`}${PORT}/socket.io/`);
    console.log(`🏠 Home: ${isProduction ? `https://` : `http://localhost:`}${PORT}/`);
    console.log(`❤️  Health: ${isProduction ? `https://` : `http://localhost:`}${PORT}/health`);
    console.log(`💬 Socket.io: Ready for connections`);
    console.log(`👥 Client count: 0`);
    console.log('='.repeat(50));
  });
};

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`💥 Port ${PORT} is already in use. Try killing the process or using a different port.`);
  }
  if (!isProduction) {
    console.log('💡 In development, you can kill the process with: lsof -ti:5000 | xargs kill -9');
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  if (isProduction) {
    console.log('Attempting graceful shutdown...');
    server.close(() => {
      process.exit(1);
    });
  } else {
    console.log('💡 Fix the error and restart the server');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  if (isProduction) {
    console.log('Attempting graceful shutdown...');
    server.close(() => {
      process.exit(1);
    });
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n📴 Received shutdown signal. Closing gracefully...');
  
  // Close all socket connections
  if (io) {
    console.log('🔌 Closing Socket.io connections...');
    io.close(() => {
      console.log('✅ Socket.io closed');
    });
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();

module.exports = { server, io };