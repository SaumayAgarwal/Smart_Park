require('dotenv').config();
const { exec } = require('child_process');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { prisma } = require('./config/db');
const { seedDatabase } = require('./config/seed');
const { initSocket } = require('./socket/socketHandler');
const { connectProducer } = require('./kafka/producer');
const { startConsumer } = require('./kafka/consumer');
const { errorHandler } = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const publicParkingRoutes = require('./routes/publicParkingRoutes');
const ownerParkingRoutes = require('./routes/ownerParkingRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const checkInRoutes = require('./routes/checkInRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
  path: '/socket.io',
});

initSocket(io);

// Global Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'smartpark-backend-node',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/parking', publicParkingRoutes);
app.use('/api/owner/parking', ownerParkingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/owner/scan', checkInRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

async function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SmartPark Node.js Server running on port ${PORT}`);
    console.log(`📡 Socket.IO server listening on ws://0.0.0.0:${PORT}/socket.io`);
  });

  // 1. Connect to MySQL via Prisma & Push Schema
  try {
    await prisma.$connect();
    console.log('✅ Connected to MySQL Database via Prisma');
    
    // Automatically synchronize database schema with remote MySQL database
    exec('npx prisma db push --skip-generate --accept-data-loss', async (err, stdout, stderr) => {
      if (err) {
        console.warn('⚠️ Prisma DB Push notice:', stderr || err.message);
      } else {
        console.log('✅ Database schema synchronized with remote MySQL!');
      }
      try {
        await seedDatabase();
      } catch (sErr) {
        console.warn('Seed notice:', sErr.message);
      }
    });
  } catch (err) {
    console.warn('⚠️ Database connection warning:', err.message);
  }

  // 2. Connect Kafka in background (non-blocking)
  setTimeout(async () => {
    try {
      await connectProducer();
      await startConsumer();
    } catch (kErr) {
      console.warn('⚠️ Kafka background initialization warning:', kErr.message);
    }
  }, 2000);
}

startServer();
