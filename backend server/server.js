const express = require('express');
// Restart trigger
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const http = require('http');
const socketIo = require('socket.io');
const { initPool } = require('./config/db');
const { getRedis } = require('./config/redis');
const ensureGroupChatSchema = require('./utils/ensureGroupChatSchema');
const ensurePostCommentsSchema = require('./utils/ensurePostCommentsSchema');
const ensureUserProfileSchema = require('./utils/ensureUserProfileSchema');

let redis;

// Load environment variables
dotenv.config();

const defaultProductionOrigins = process.env.NODE_ENV === 'production' ? ['https://klian.pages.dev'] : [];
const allowedOrigins = [
  ...defaultProductionOrigins,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
]
  .map(origin => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  
  // Dynamically match local/private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost)
  const localIpPattern = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/;
  return localIpPattern.test(origin);
};

const app = express();
app.set('trust proxy', 1); // NGINX reverse proxy compatibility
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach socket.io to app for use in controllers
app.set('io', io);

// Import socket handlers
const setupMessageHandlers = require('./socket/messageHandlers');
const { startEventReminderScheduler } = require('./utils/eventReminderScheduler');

// Security & performance middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Basic global rate limiter (can override per-route)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // 300 req/min per IP; adjust as needed
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Strict authentication rate limiting (10 attempts per 15 minutes per IP)
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', strictAuthLimiter);
app.use('/api/auth/register', strictAuthLimiter);
app.use('/api/auth/verify', strictAuthLimiter);
app.use('/api/auth/resend-otp', strictAuthLimiter);

const path = require('path');

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global XSS Input Sanitization Middleware
const { sanitizeInput } = require('./middleware/sanitize');
app.use(sanitizeInput);

// Static folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sessions backed by Redis (attempt to initialize Upstash or provided REDIS_URL when requested)
const sessionConfig = {
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'session_secret_dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
};

if (process.env.USE_REDIS === 'true') {
  try {
    redis = getRedis();
    sessionConfig.store = new RedisStore({ client: redis });
    console.log('Session store configured to use Redis');
  } catch (err) {
    console.warn('Failed to initialize Redis for session store, falling back to memory store:', err.message);
  }
} else {
  console.warn('Using memory store for sessions (NOT recommended for production)');
}

app.use(session(sessionConfig));

// Authentication middleware for Socket.io connections
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Allow connection but mark as unauthenticated. Private messaging & join events will block.
    socket.decodedUserId = null;
    return next();
  }
  
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
    if (err) {
      console.warn(`Socket connection with invalid token blocked: ${socket.id}`);
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.decodedUserId = decoded.id; // Store validated user ID
    next();
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Presence tracking using Redis; rooms: user:{id}, role:{role}, all-users
  socket.on('join', async (userData = {}) => {
    try {
      const userId = userData.id ? String(userData.id).trim() : null;
      const role = userData.role ? String(userData.role).trim() : null;
      const name = userData.name || '';

      // Validate identity: user can ONLY join their own private room
      if (!socket.decodedUserId || String(socket.decodedUserId) !== userId) {
        console.warn(`Unauthorized join event blocked: Socket ${socket.id} tried to join room for user ID ${userId}`);
        socket.emit('message-error', { error: 'Unauthorized room access' });
        return;
      }

      socket.userId = userId;
      socket.userRole = role;
      socket.userName = name;

      socket.join('all-users');
      if (role) socket.join(`role:${role}`);
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined room: user:${userId}`);
        if (redis) {
          await redis.sadd('presence:online', userId);
          await redis.hset(`presence:sockets:${userId}`, socket.id, Date.now());
        }
      }
      console.log(`User joined: ${name}, Role: ${role}, Id: ${userId}`);
    } catch (e) {
      console.error('join handler error', e);
    }
  });

  // Set up message handlers
  setupMessageHandlers(io, socket, redis);

  // Handle new announcement broadcast
  socket.on('new-announcement', (data) => {
    io.emit('announcement-created', data);
  });

  // Handle announcement read
  socket.on('announcement-read', (data) => {
    io.emit('announcement-read', data);
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      if (redis) {
        // Attempt to remove socket mapping; if user has no more sockets, optionally update presence
        const keys = await redis.keys('presence:sockets:*');
        for (const key of keys) {
          const removed = await redis.hdel(key, socket.id);
          if (removed) {
            const userId = key.split(':').pop();
            const remaining = await redis.hlen(key);
            if (remaining === 0) {
              await redis.srem('presence:online', userId);
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error('disconnect cleanup error', e);
    }
    console.log('Client disconnected', socket.id);
  });
});

async function bootstrap() {
  try {
    await initPool();
    await ensureGroupChatSchema();
    await ensurePostCommentsSchema();
    await ensureUserProfileSchema();

    // Clean up any orphan group add notifications (self-healing db routine)
    const { query } = require('./config/db');
    await query("DELETE FROM notifications WHERE type = 'GROUP_ADDED' AND group_id NOT IN (SELECT id FROM groups)");
    console.log('Orphan group add notifications cleaned up.');

    if (process.env.USE_REDIS === 'true') {
      redis = getRedis();
    } else {
      console.warn('Redis is disabled via USE_REDIS env var.');
    }
  } catch (err) {
    console.warn('DB/Redis initialization failed, falling back to mock mode:', err.message);
  }

  // Make io accessible to our routes
  app.set('io', io);
  startEventReminderScheduler(io);

  const PORT = process.env.PORT || 5000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} and accessible on 0.0.0.0`);
  });
}

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/emails', require('./routes/emailRoutes'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Basic route
app.get('/', (req, res) => {
  res.send('KL University API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} signal received: closing HTTP server and MySQL pools gracefully...`);
  
  // Close HTTP Server
  server.close(() => {
    console.log('HTTP server closed.');
  });

  try {
    const { getPool } = require('./config/db');
    const pool = getPool();
    if (pool) {
      await pool.end();
      console.log('MySQL connection pool closed.');
    }
  } catch (err) {
    console.error('Error closing MySQL pool during shutdown:', err.message);
  }

  console.log('Shutdown process completed. exiting...');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap();