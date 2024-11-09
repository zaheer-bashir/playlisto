import express from 'express';
import { createServer } from 'http';
import { initializeSocketServer } from './server/socket';

const app = express();
const server = createServer(app);

initializeSocketServer(server);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 