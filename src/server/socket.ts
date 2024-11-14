import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Player {
  id: string;
  userId: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  score: number;
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

interface GameState {
  currentRound: number;
  totalRounds: number;
  players: Player[];
  currentSong?: {
    previewUrl: string;
    duration: number;
    startTime: number;
  };
}

interface Game {
  id: string;
  state: GameState;
  playlist: any[]; // Replace with proper Spotify track type
  currentSongIndex: number;
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
      logEvent('Socket Error', { socketId: socket.id, error });
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
        isHost: isHost,
        score: 0
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
    socket.on('startGame', async ({ lobbyId, accessToken }) => {
      logEvent('Start Game Request', { lobbyId, socketId: socket.id });
      
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.hostId !== socket.id) {
        logEvent('Start Game Failed', { 
          reason: !lobby ? 'Lobby not found' : 'Not host',
          lobbyId,
          socketId: socket.id 
        });
        return;
      }

      try {
        // Fetch playlist tracks
        const tracks = await fetchPlaylistTracks(lobby.spotifyPlaylist!.id, accessToken);
        
        // Shuffle tracks
        const shuffledTracks = tracks.sort(() => Math.random() - 0.5);

        const game: Game = {
          id: lobbyId,
          state: {
            currentRound: 1,
            totalRounds: Math.min(10, shuffledTracks.length),
            players: lobby.players.map(p => ({
              ...p,
              score: 0
            }))
          },
          playlist: shuffledTracks,
          currentSongIndex: 0
        };

        games.set(lobbyId, game);
        logEvent('Game Created', { gameId: lobbyId, players: game.state.players });

        // Start first round
        await startNewRound(lobbyId, io);

        io.to(lobbyId).emit('gameStateUpdate', game.state);
      } catch (error) {
        logEvent('Start Game Error', { error, lobbyId });
        io.to(lobbyId).emit('error', 'Failed to start game');
      }
    });

    // Handle guess submission
    socket.on('submitGuess', ({ gameId, guess }) => {
      logEvent('Guess Submitted', { gameId, socketId: socket.id, guess });
      
      const game = games.get(gameId);
      if (!game) {
        logEvent('Guess Failed', { reason: 'Game not found', gameId });
        return;
      }

      const player = game.state.players.find(p => p.id === socket.id);
      if (!player) {
        logEvent('Guess Failed', { reason: 'Player not found', gameId, socketId: socket.id });
        return;
      }

      // Compare guess with current song
      const currentSong = game.playlist[game.currentSongIndex];
      const isCorrect = compareGuess(guess, currentSong.name);

      logEvent('Guess Result', { 
        gameId,
        playerId: socket.id,
        guess,
        isCorrect,
        correctAnswer: currentSong.name
      });

      if (isCorrect) {
        // Award points based on timing
        const points = calculatePoints(game.state.currentSong?.startTime);
        player.score += points;

        // Notify all players
        io.to(gameId).emit('guessResult', {
          playerId: socket.id,
          playerName: player.name,
          correct: true,
          points,
          guess
        });

        // Check if round should end
        checkRoundEnd(gameId, io);
      } else {
        socket.emit('guessResult', {
          correct: false,
          guess
        });
      }

      io.to(gameId).emit('gameStateUpdate', game.state);
    });

    // Handle song extension (host only)
    socket.on('extendSong', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game || !game.state.currentSong) return;

      const lobby = lobbies.get(gameId);
      if (!lobby || lobby.hostId !== socket.id) return;

      // Extend current song duration
      game.state.currentSong.duration += 500; // Add 0.5 seconds
      io.to(gameId).emit('songExtended', game.state.currentSong);
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

// Helper functions
async function startNewRound(gameId: string, io: Server) {
  const game = games.get(gameId);
  if (!game) return;
  
  // Get next song
  const song = game.playlist[game.currentSongIndex];
  
  game.state.currentSong = {
    previewUrl: song.preview_url,
    duration: 500, // Start with 0.5 seconds
    startTime: Date.now()
  };

  // Broadcast new round
  io.to(gameId).emit('newRound', {
    round: game.state.currentRound,
    song: game.state.currentSong
  });
}

// Update the compareGuess function to use fuzzy matching
function compareGuess(guess: string, answer: string): boolean {
  // Convert both strings to lowercase and remove special characters
  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  };

  const normalizedGuess = normalizeString(guess);
  const normalizedAnswer = normalizeString(answer);

  // Exact match
  if (normalizedGuess === normalizedAnswer) return true;

  // Check if the guess is contained within the answer or vice versa
  if (normalizedAnswer.includes(normalizedGuess) || normalizedGuess.includes(normalizedAnswer)) {
    return true;
  }

  // Calculate Levenshtein distance for fuzzy matching
  const maxDistance = Math.floor(Math.max(normalizedGuess.length, normalizedAnswer.length) * 0.3);
  const distance = levenshteinDistance(normalizedGuess, normalizedAnswer);
  
  return distance <= maxDistance;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

function calculatePoints(startTime?: number): number {
  if (!startTime) return 50;
  
  const timeTaken = Date.now() - startTime;
  // Award more points for faster guesses
  return Math.max(100 - Math.floor(timeTaken / 1000) * 10, 50);
}

function checkRoundEnd(gameId: string, io: Server) {
  const game = games.get(gameId);
  if (!game) return;

  const allGuessedCorrectly = game.state.players.every(p => 
    // Add logic to check if player has guessed correctly
    true
  );

  if (allGuessedCorrectly) {
    endRound(gameId, io);
  }
}

function endRound(gameId: string, io: Server) {
  const game = games.get(gameId);
  if (!game) return;

  // Move to next round
  game.state.currentRound++;
  game.currentSongIndex++;

  if (game.state.currentRound > game.state.totalRounds) {
    // End game
    io.to(gameId).emit('gameEnd', {
      finalScores: game.state.players
    });
    games.delete(gameId);
  } else {
    // Start next round
    startNewRound(gameId, io);
  }
}