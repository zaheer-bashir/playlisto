import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
}

interface Lobby {
  id: string;
  players: Player[];
  spotifyPlaylist?: {
    id: string;
    name: string;
  };
}

const lobbies = new Map<string, Lobby>();

const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.NEXT_PUBLIC_APP_URL || "https://your-production-url.com"]
  : ["http://localhost:3000"];

export function initializeSocketServer(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  io.on('connect', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Join lobby
    socket.on('joinLobby', ({ lobbyId, playerName, isHost }) => {
      const lobby = lobbies.get(lobbyId);
      
      if (!lobby && !isHost) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
        isReady: false,
        isHost: isHost
      };

      if (!lobby) {
        // Create new lobby if player is host
        lobbies.set(lobbyId, {
          id: lobbyId,
          players: [player]
        });
      } else {
        // Add player to existing lobby
        lobby.players.push(player);
        lobbies.set(lobbyId, lobby);
      }

      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
    });

    // Toggle ready status
    socket.on('toggleReady', ({ lobbyId }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        lobbies.set(lobbyId, lobby);
        io.to(lobbyId).emit('lobbyUpdate', lobby);
      }
    });

    // Update playlist selection
    socket.on('updatePlaylist', ({ lobbyId, playlist }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (player?.isHost) {
        lobby.spotifyPlaylist = playlist;
        lobbies.set(lobbyId, lobby);
        io.to(lobbyId).emit('lobbyUpdate', lobby);
      }
    });

    // Start game
    socket.on('startGame', ({ lobbyId }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (player?.isHost && lobby.players.every(p => p.isReady)) {
        io.to(lobbyId).emit('gameStart', lobby.spotifyPlaylist);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      for (const [lobbyId, lobby] of lobbies.entries()) {
        const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          lobby.players.splice(playerIndex, 1);
          
          if (lobby.players.length === 0) {
            lobbies.delete(lobbyId);
          } else {
            // If host disconnected, assign new host
            if (lobby.players.every(p => !p.isHost)) {
              lobby.players[0].isHost = true;
            }
            lobbies.set(lobbyId, lobby);
            io.to(lobbyId).emit('lobbyUpdate', lobby);
          }
          break;
        }
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log('Connection error:', err);
  });

  return io;
}