import { Server as HTTPServer } from 'http';
import { Server, Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Player {
  id: string;
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
const games = new Map<string, Game>();

function logEvent(event: string, data: any) {
  console.log(`[${new Date().toISOString()}] ${event}:`, JSON.stringify(data, null, 2));
}

// Add this function to fetch playlist tracks
async function fetchPlaylistTracks(playlistId: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,preview_url))`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.items
      .filter((item: any) => item.track && item.track.preview_url)
      .map((item: any) => ({
        name: item.track.name,
        preview_url: item.track.preview_url
      }));
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
}

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
    logEvent('Connection', { socketId: socket.id });

    socket.on('error', (error) => {
      logEvent('Socket Error', { socketId: socket.id, error });
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