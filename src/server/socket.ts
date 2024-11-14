import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Player {
  id: string;
  userId: string;
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
const userSocketMap = new Map<string, string>(); // Track userId to socketId

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// Modify the function to accept io as a parameter
const cleanupUserConnections = (io: SocketIOServer, userId: string, socket: Socket) => {
  debugLog('Cleaning up old connections for user:', { userId, newSocketId: socket.id });
  
  // Find and clean up any existing lobbies this user is in
  for (const [lobbyId, lobby] of lobbies.entries()) {
    const existingPlayer = lobby.players.find(p => p.userId === userId);
    if (existingPlayer && existingPlayer.id !== socket.id) {
      debugLog('Found existing player in lobby:', { 
        lobbyId, 
        existingPlayerId: existingPlayer.id,
        newSocketId: socket.id 
      });
      
      // Remove old socket mapping
      socketToLobbyMap.delete(existingPlayer.id);
      
      // Update player's socket ID
      existingPlayer.id = socket.id;
      if (existingPlayer.isHost) {
        lobby.hostId = socket.id;
      }
      
      // Update lobby
      lobbies.set(lobbyId, lobby);
      
      // Join the new socket to the lobby
      socket.join(lobbyId);
      socketToLobbyMap.set(socket.id, lobbyId);
      
      // Emit update
      io.to(lobbyId).emit('lobbyUpdate', lobby);
    }
  }
};

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
    const userId = socket.handshake.auth.userId;
    debugLog('New socket connection:', {
      socketId: socket.id,
      userId,
      existingSocketMapping: Array.from(userSocketMap.entries())
    });

    if (userId) {
      const existingSocketId = userSocketMap.get(userId);
      debugLog('Existing socket for userId:', {
        userId,
        existingSocketId,
        newSocketId: socket.id
      });
      
      // Pass io to the cleanupUserConnections function
      cleanupUserConnections(io, userId, socket);
      
      // Update socket mapping
      userSocketMap.set(userId, socket.id);
    }

    console.log('Client connected:', { socketId: socket.id, userId });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Join lobby
    socket.on('joinLobby', ({ lobbyId, playerName, isHost, userId }) => {
      debugLog('Join lobby request:', {
        socketId: socket.id,
        userId,
        playerName,
        isHost,
        lobbyId
      });

      const lobby = lobbies.get(lobbyId);

      // If user is already in any lobby, clean up first
      for (const [existingLobbyId, existingLobby] of lobbies.entries()) {
        if (existingLobbyId !== lobbyId) {
          const playerInOtherLobby = existingLobby.players.find(p => p.userId === userId);
          if (playerInOtherLobby) {
            existingLobby.players = existingLobby.players.filter(p => p.userId !== userId);
            if (existingLobby.players.length === 0) {
              lobbies.delete(existingLobbyId);
            } else {
              lobbies.set(existingLobbyId, existingLobby);
              io.to(existingLobbyId).emit('lobbyUpdate', existingLobby);
            }
          }
        }
      }

      // Check if this userId is already a host in this lobby
      if (isHost && lobby) {
        const existingHost = lobby.players.find(p => p.isHost && p.userId === userId);
        debugLog('Checking existing host:', {
          userId,
          existingHost,
          lobbyHostId: lobby.hostId
        });
        
        if (existingHost) {
          debugLog('User is already host in this lobby', {
            userId,
            existingHostId: existingHost.id,
            newSocketId: socket.id
          });
          // Update the socket ID for the existing host
          existingHost.id = socket.id;
          lobby.hostId = socket.id;
          socketToLobbyMap.set(socket.id, lobbyId);
          userSocketMap.set(userId, socket.id);
          socket.join(lobbyId);
          io.to(lobbyId).emit('lobbyUpdate', lobby);
          return;
        }
      }

      // If this userId is already in this lobby, handle reconnection
      const existingPlayer = lobby?.players.find(p => p.userId === userId);
      if (existingPlayer) {
        debugLog('Found existing player:', {
          userId,
          existingPlayerId: existingPlayer.id,
          newSocketId: socket.id
        });
        // Update the socket ID for the existing player
        existingPlayer.id = socket.id;
        if (lobby && existingPlayer.isHost) {
          lobby.hostId = socket.id;
        }
        
        // Update mappings
        socketToLobbyMap.set(socket.id, lobbyId);
        userSocketMap.set(userId, socket.id);
        socket.join(lobbyId);
        io.to(lobbyId).emit('lobbyUpdate', lobby);

        return;
      }

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
        userId: userId,
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
        const existingPlayer = lobby.players.find(p => p.name === playerName);
        if (existingPlayer) {
          socket.emit('error', 'Player name already taken');
          return;
        }

        lobby.players.push(player);
        lobbies.set(lobbyId, lobby);
      }

      // Update mappings
      socketToLobbyMap.set(socket.id, lobbyId);
      userSocketMap.set(userId, socket.id);
      
      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
      
      console.log(`Lobby ${lobbyId} players:`, lobby?.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })));

      debugLog('Final lobby state:', {
        lobbyId,
        players: lobbies.get(lobbyId)?.players.map(p => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          isHost: p.isHost
        }))
      });
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
      const userId = Array.from(userSocketMap.entries())
        .find(([_, socketId]) => socketId === socket.id)?.[0];
      
      debugLog('Socket disconnected:', {
        socketId: socket.id,
        userId,
        remainingSocketMappings: Array.from(userSocketMap.entries())
      });

      if (userId) {
        userSocketMap.delete(userId);
      }

      const lobbyId = socketToLobbyMap.get(socket.id);
      if (lobbyId) {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
          const disconnectedPlayer = lobby.players.find(p => p.id === socket.id);
          
          if (disconnectedPlayer) {
            setTimeout(() => {
              const lobby = lobbies.get(lobbyId);
              if (lobby) {
                // Check if player has reconnected
                const hasReconnected = userSocketMap.has(disconnectedPlayer.userId);
                
                if (!hasReconnected) {
                  lobby.players = lobby.players.filter(p => p.userId !== disconnectedPlayer.userId);
                  
                  if (lobby.players.length === 0) {
                    lobbies.delete(lobbyId);
                  } else if (disconnectedPlayer.isHost) {
                    const newHost = lobby.players[0];
                    newHost.isHost = true;
                    newHost.isReady = true;
                    lobby.hostId = newHost.id;
                    lobbies.set(lobbyId, lobby);
                    io.to(lobbyId).emit('lobbyUpdate', lobby);
                  } else {
                    lobbies.set(lobbyId, lobby);
                    io.to(lobbyId).emit('lobbyUpdate', lobby);
                  }
                }
              }
              socketToLobbyMap.delete(socket.id);
            }, 5000);
          }
        }
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log('Connection error:', err);
  });

  return io;
}