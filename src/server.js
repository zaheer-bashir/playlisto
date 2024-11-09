import express from 'express';
import { createServer } from 'http';
import { initializeSocketServer } from './server/socket.js';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

const server = createServer(app);

// Add basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const io = initializeSocketServer(server);

// Add error handler
server.on('error', (error) => {
  console.error('Server error:', error);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});