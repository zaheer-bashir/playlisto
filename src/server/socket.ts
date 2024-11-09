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
  hostId?: string;
  spotifyPlaylist?: {
    id: string;
    name: string;
  };
}

const lobbies = new Map<string, Lobby>();
const socketToLobbyMap = new Map<string, string>(); // Track which lobby each socket is in

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
      console.log(`Join lobby request - ID: ${socket.id}, Name: ${playerName}, Host: ${isHost}`);
      
      const lobby = lobbies.get(lobbyId);
      
      // If this socket is already in this lobby, don't add them again
      if (socketToLobbyMap.get(socket.id) === lobbyId) {
        const existingPlayer = lobby?.players.find(p => p.id === socket.id);
        if (existingPlayer) {
          console.log(`Socket ${socket.id} already in lobby ${lobbyId}`);
          return;
        }
      }

      // If trying to join as host but lobby exists with a different host, reject
      if (isHost && lobby?.hostId && lobby.hostId !== socket.id) {
        socket.emit('error', 'Lobby already has a host');
        return;
      }

      // Remove player from their previous lobby if they're in one
      const previousLobbyId = socketToLobbyMap.get(socket.id);
      if (previousLobbyId) {
        const previousLobby = lobbies.get(previousLobbyId);
        if (previousLobby) {
          previousLobby.players = previousLobby.players.filter(p => p.id !== socket.id);
          if (previousLobby.players.length === 0) {
            lobbies.delete(previousLobbyId);
          } else {
            lobbies.set(previousLobbyId, previousLobby);
          }
          socket.leave(previousLobbyId);
        }
        socketToLobbyMap.delete(socket.id);
      }

      // Handle non-host trying to join non-existent lobby
      if (!lobby && !isHost) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
        isReady: isHost,
        isHost: isHost
      };

      if (!lobby) {
        // Create new lobby if player is host
        lobbies.set(lobbyId, {
          id: lobbyId,
          players: [player],
          hostId: socket.id
        });
      } else {
        // Check if player with same name already exists
        const existingPlayer = lobby.players.find(p => p.name === playerName && p.id !== socket.id);
        if (existingPlayer) {
          socket.emit('error', 'Player name already taken');
          return;
        }

        // Remove any existing entries for this socket
        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        
        // Add the player
        lobby.players.push(player);
        lobbies.set(lobbyId, lobby);
      }

      // Update socket to lobby mapping
      socketToLobbyMap.set(socket.id, lobbyId);
      
      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
      
      console.log(`Lobby ${lobbyId} players:`, lobby?.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })));
    });

    // Toggle ready status (only for non-host players)
    socket.on('toggleReady', ({ lobbyId }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (player && !player.isHost) {
        player.isReady = !player.isReady;
        lobbies.set(lobbyId, lobby);
        io.to(lobbyId).emit('lobbyUpdate', lobby);
      }
    });

    // Update playlist selection
    socket.on('updatePlaylist', ({ lobbyId, playlist }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.hostId !== socket.id) return;

      lobby.spotifyPlaylist = playlist;
      lobbies.set(lobbyId, lobby);
      io.to(lobbyId).emit('lobbyUpdate', lobby);
    });

    // Start game
    socket.on('startGame', ({ lobbyId }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.hostId !== socket.id) return;

      // Check if all non-host players are ready
      const allPlayersReady = lobby.players
        .filter(p => !p.isHost)
        .every(p => p.isReady);

      if (allPlayersReady) {
        io.to(lobbyId).emit('gameStart', lobby.spotifyPlaylist);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const lobbyId = socketToLobbyMap.get(socket.id);
      if (lobbyId) {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
          lobby.players = lobby.players.filter(p => p.id !== socket.id);
          
          if (lobby.players.length === 0) {
            lobbies.delete(lobbyId);
          } else {
            // If host disconnected, assign new host
            if (socket.id === lobby.hostId) {
              const newHost = lobby.players[0];
              newHost.isHost = true;
              newHost.isReady = true;
              lobby.hostId = newHost.id;
            }
            lobbies.set(lobbyId, lobby);
            io.to(lobbyId).emit('lobbyUpdate', lobby);
          }
        }
        socketToLobbyMap.delete(socket.id);
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log('Connection error:', err);
  });

  return io;
}