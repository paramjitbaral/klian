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

// Load environment variables
dotenv.config();

// Initialize MySQL and Redis (Optional for demo)
let redis;
try {
  initPool();
  if (process.env.USE_REDIS === 'true') {
    redis = getRedis();
  } else {
    console.warn('Redis is disabled via USE_REDIS env var.');
  }
} catch (err) {
  console.warn('DB/Redis initialization failed, falling back to mock mode:', err.message);
}

const app = express();
app.set('trust proxy', 1); // NGINX reverse proxy compatibility
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach socket.io to app for use in controllers
app.set('io', io);

// Import socket handlers
const setupMessageHandlers = require('./socket/messageHandlers');

// Security & performance middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
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

const path = require('path');

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sessions backed by Redis (fallback to memory if redis fails)
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

if (redis) {
  sessionConfig.store = new RedisStore({ client: redis });
} else {
  console.warn('Using memory store for sessions (NOT recommended for production)');
}

app.use(session(sessionConfig));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Presence tracking using Redis; rooms: user:{id}, role:{role}, all-users
  socket.on('join', async (userData = {}) => {
    try {
      const userId = userData.id ? String(userData.id).trim() : null;
      const role = userData.role ? String(userData.role).trim() : null;
      const name = userData.name || '';

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

// Make io accessible to our routes
app.set('io', io);

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

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and accessible on 0.0.0.0`);
});