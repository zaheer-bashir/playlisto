"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
var socket_io_1 = require("socket.io");
var lobbies = new Map();
var socketToLobbyMap = new Map();
var userSocketMap = new Map();
var gameUsedSongs = new Map();

function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric characters
}

function initializeSocketServer(server) {
  var io = new socket_io_1.Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.on("connection", function (socket) {
    var userId = socket.handshake.auth.userId;
    console.log("New socket connection:", {
      socketId: socket.id,
      userId,
      existingSocketMapping: Array.from(userSocketMap.entries()),
    });
    if (userId) {
      var existingSocketId = userSocketMap.get(userId);
      if (existingSocketId) {
        console.log("Existing socket found for userId:", {
          userId,
          existingSocketId,
          newSocketId: socket.id,
        });
      }
      userSocketMap.set(userId, socket.id);
    }
    // Join lobby
    socket.on("joinLobby", function (_a) {
      var lobbyId = _a.lobbyId,
        playerName = _a.playerName,
        isHost = _a.isHost,
        userId = _a.userId;
      console.log("Join lobby request received:", {
        socketId: socket.id,
        userId,
        playerName,
        isHost,
        lobbyId,
        timestamp: new Date().toISOString(),
      });
      var lobby = lobbies.get(lobbyId);
      console.log("Current lobby state:", {
        lobbyId,
        exists: !!lobby,
        playerCount: lobby?.players?.length || 0,
        players: lobby?.players?.map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
        })),
        timestamp: new Date().toISOString(),
      });
      // Check for existing player with this userId
      var existingPlayer = lobby?.players.find(function (p) {
        return p.userId === userId;
      });
      console.log("temp 2:", existingPlayer);
      if (existingPlayer) {
        console.log("Found existing player:", {
          userId,
          existingPlayerId: existingPlayer.id,
          newSocketId: socket.id,
          isHost: existingPlayer.isHost,
        });
        // Update the socket ID for the existing player
        existingPlayer.id = socket.id;
        // Maintain host status based on userId
        if (lobby.hostId === userId) {
          existingPlayer.isHost = true;
        }
        // Update mappings
        socketToLobbyMap.set(socket.id, lobbyId);
        userSocketMap.set(userId, socket.id);
        socket.join(lobbyId);
        console.log("Emitting lobbyUpdate:", {
          lobbyId,
          players: lobby?.players?.map((p) => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
          })),
          timestamp: new Date().toISOString(),
        });
        io.to(lobbyId).emit("lobbyUpdate", lobby);
        // If game is in progress, send complete game state
        if (lobby.gameState) {
          const completeGameState = {
            ...lobby.gameState,
            hostId: lobby.hostId,
            spotifyToken: lobby.spotifyToken,
            playlist: lobby.gameState.playlist,
            currentSong: lobby.gameState.currentSong,
            players: lobby.players.map((p) => ({
              id: p.id,
              userId: p.userId,
              name: p.name,
              score: p.score || 0,
              isHost: p.isHost,
              hasGuessedCorrectly: p.hasGuessedCorrectly,
            })),
          };
          socket.emit("gameState", completeGameState);
        }
        return;
      }
      console.log("temp 3:", !lobby && !isHost);
      if (!lobby && !isHost) {
        socket.emit("error", "Lobby not found");
        return;
      }
      var player = {
        id: socket.id,
        userId: userId,
        name: playerName,
        isReady: isHost,
        isHost: isHost,
      };
      console.log("temp 4:", !lobby);
      if (!lobby) {
        // Create new lobby if player is host
        console.log("Creating new lobby with host:", {
          lobbyId,
          hostUserId: userId,
          timestamp: new Date().toISOString(),
        });
        lobbies.set(lobbyId, {
          id: lobbyId,
          players: [player],
          hostId: userId,
        });
      } else {
        // Check if player with same name already exists
        var nameExists = lobby.players.some(function (p) {
          return p.name === playerName && p.userId !== userId;
        });
        if (nameExists) {
          socket.emit("error", "Player name already taken");
          return;
        }
        lobby.players.push(player);
        lobbies.set(lobbyId, lobby);
      }
      // Update mappings
      socketToLobbyMap.set(socket.id, lobbyId);
      userSocketMap.set(userId, socket.id);
      socket.join(lobbyId);
      console.log("Emitting lobbyUpdate:", {
        lobbyId,
        players: lobby?.players?.map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
        })),
        timestamp: new Date().toISOString(),
      });
      io.to(lobbyId).emit("lobbyUpdate", lobbies.get(lobbyId));
    });
    // Toggle ready status
    socket.on("toggleReady", function (_a) {
      var lobbyId = _a.lobbyId;
      var lobby = lobbies.get(lobbyId);
      if (!lobby) return;
      var player = lobby.players.find(function (p) {
        return p.id === socket.id;
      });
      if (player) {
        player.isReady = !player.isReady;
        lobbies.set(lobbyId, lobby);
        io.to(lobbyId).emit("lobbyUpdate", lobby);
      }
    });
    // Update playlist selection
    socket.on("updatePlaylist", function (_a) {
      var lobbyId = _a.lobbyId,
        playlist = _a.playlist;
      var lobby = lobbies.get(lobbyId);
      if (!lobby) return;
      var player = lobby.players.find(function (p) {
        return p.id === socket.id;
      });
      if (player === null || player === void 0 ? void 0 : player.isHost) {
        lobby.spotifyPlaylist = playlist;
        lobbies.set(lobbyId, lobby);
        io.to(lobbyId).emit("lobbyUpdate", lobby);
      }
    });
    // Start game
    socket.on("startGame", async function (_a) {
      var { lobbyId, playlist, spotifyToken } = _a;
      var lobby = lobbies.get(lobbyId);

      console.log("🟡 StartGame received with data:", {
        lobbyId,
        hasPlaylist: !!playlist,
        playlistTracks: playlist?.tracks?.items?.length || 0,
        hasToken: !!spotifyToken,
        timestamp: new Date().toISOString(),
      });

      if (!lobby) {
        console.log("🔴 Start game failed - lobby not found:", { lobbyId });
        return;
      }

      // Initialize game state with playlist
      lobby.gameState = {
        currentRound: 1,
        totalRounds: 10,
        players: lobby.players.map((p) => ({
          id: p.id,
          name: p.name,
          score: 0,
          isHost: p.isHost,
        })),
        isPlaying: true,
        playlist: playlist,
        hostId: lobby.hostId,
        spotifyToken: spotifyToken,
      };

      // Save the updated lobby state
      lobbies.set(lobbyId, lobby);

      // Start first round immediately
      try {
        // Get all available tracks
        const availableTracks = playlist.tracks.items
          .filter((item) => item.track)
          .map((item) => item.track);

        // Select random song
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        const selectedSong = availableTracks[randomIndex];

        const serverTime = Date.now();
        const roundDuration = 30000; // 30 seconds

        // Update game state with first song
        lobby.gameState = {
          ...lobby.gameState,
          currentSong: {
            id: selectedSong.id,
            name: selectedSong.name,
            duration: roundDuration,
            startTime: serverTime,
          },
          isPlaying: true,
          playlist: playlist, // Ensure playlist is included
        };

        // Save and emit updated state
        lobbies.set(lobbyId, lobby);

        // Emit complete game state
        io.to(lobbyId).emit("gameState", {
          ...lobby.gameState,
          hostId: lobby.hostId,
          spotifyToken: spotifyToken,
          playlist: playlist,
          currentSong: {
            id: selectedSong.id,
            name: selectedSong.name,
            duration: roundDuration,
            startTime: serverTime,
          },
        });

        console.log("🟢 Game started with initial song:", {
          lobbyId,
          songId: selectedSong.id,
          songName: selectedSong.name,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("🔴 Error starting game:", error);
        socket.emit("error", "Failed to start game");
      }
    });
    // Handle disconnection
    socket.on("disconnect", function () {
      console.log("Socket disconnecting:", {
        socketId: socket.id,
        rooms: Array.from(socket.rooms || []),
        timestamp: new Date().toISOString(),
      });
      var foundEntry = Array.from(userSocketMap.entries()).find(function (
        entry
      ) {
        return entry[1] === socket.id;
      });

      var userId = foundEntry ? foundEntry[0] : null;

      console.log("Socket disconnected:", {
        socketId: socket.id,
        userId,
        timestamp: new Date().toISOString(),
      });

      if (userId) {
        userSocketMap.delete(userId);
      }

      var lobbyId = socketToLobbyMap.get(socket.id);
      if (lobbyId) {
        var lobby = lobbies.get(lobbyId);
        if (lobby) {
          var disconnectedPlayer = lobby.players.find(function (p) {
            return p.userId === userId;
          });
          if (disconnectedPlayer) {
            setTimeout(function () {
              var lobby = lobbies.get(lobbyId);
              if (lobby) {
                var hasReconnected = userSocketMap.has(userId);
                if (!hasReconnected) {
                  lobby.players = lobby.players.filter(function (p) {
                    return p.userId !== userId;
                  });
                  if (lobby.players.length === 0) {
                    lobbies.delete(lobbyId);
                    gameUsedSongs.delete(lobbyId);
                  } else if (lobby.hostId === userId) {
                    var newHost = lobby.players[0];
                    newHost.isHost = true;
                    newHost.isReady = true;
                    lobby.hostId = newHost.userId;
                    console.log("Transferring host status:", {
                      oldHostId: userId,
                      newHostId: newHost.userId,
                      timestamp: new Date().toISOString(),
                    });
                    lobbies.set(lobbyId, lobby);
                    io.to(lobbyId).emit("lobbyUpdate", lobby);
                  } else {
                    lobbies.set(lobbyId, lobby);
                    io.to(lobbyId).emit("lobbyUpdate", lobby);
                  }
                }
              }
              socketToLobbyMap.delete(socket.id);
            }, 5000);
          }
        }
      }
    });
    // Add logging for room joins
    socket.on("room", (room) => {
      console.log("Socket joined room:", {
        socketId: socket.id,
        room,
        timestamp: new Date().toISOString(),
      });
    });
    // Add logging for socket.join
    const originalJoin = socket.join;
    socket.join = function (...args) {
      console.log("Socket joining room:", {
        socketId: socket.id,
        room: args[0],
        timestamp: new Date().toISOString(),
      });
      return originalJoin.apply(this, args);
    };
    // Add error event handler
    socket.on("error", (error) => {
      console.error("Socket error:", {
        socketId: socket.id,
        error,
        timestamp: new Date().toISOString(),
      });
    });
    // Add handler for game state requests
    socket.on("requestGameState", function ({ gameId, userId }) {
      console.log("🟡 Game state requested:", {
        gameId,
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      const lobby = lobbies.get(gameId);
      if (!lobby?.gameState) {
        console.log("🔴 No game state found:", { gameId });
        return;
      }

      // Update the socket ID for the player
      const player = lobby.players.find(p => p.userId === userId);
      if (player) {
        player.id = socket.id;
        lobbies.set(gameId, lobby);
        
        // Ensure all players are in the room
        ensurePlayersInRoom(io, lobby);
        
        console.log("🟢 Updated player socket ID:", {
          userId,
          oldSocketId: player.id,
          newSocketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Send complete game state
      socket.emit("gameState", {
        ...lobby.gameState,
        hostId: lobby.hostId,
        spotifyToken: lobby.spotifyToken,
        playlist: lobby.gameState.playlist,
        currentSong: lobby.gameState.currentSong,
      });
    });
    // Update the startRound handler
    socket.on("startRound", async ({ lobbyId }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || socket.handshake.auth.userId !== lobby.hostId) return;

      try {
        // Get a random song that hasn't been used
        const usedSongs = gameUsedSongs.get(lobbyId) || new Set();
        const availableSongs = lobby.gameState.playlist.tracks.items.filter(
          (item) => !usedSongs.has(item.track.id)
        );

        if (availableSongs.length === 0) {
          socket.emit("error", "No more songs available");
          return;
        }

        const selectedSong =
          availableSongs[Math.floor(Math.random() * availableSongs.length)]
            .track;

        const serverTime = Date.now();
        const roundDuration = 30000; // 30 seconds per round

        // Preserve player scores and just update round-specific state
        lobby.gameState = {
          ...lobby.gameState,
          isPlaying: true,
          currentRound: lobby.gameState.currentRound || 1,
          currentSong: {
            id: selectedSong.id,
            name: selectedSong.name,
            duration: roundDuration,
            startTime: serverTime,
          },
          // Preserve the players array with their scores
          players: lobby.players.map((player) => ({
            ...player,
            hasGuessedCorrectly: false, // Reset only the round-specific state
          })),
          playlist: lobby.gameState.playlist,
        };

        // Mark song as used
        usedSongs.add(selectedSong.id);
        gameUsedSongs.set(lobbyId, usedSongs);

        console.log("🟢 Starting round with song:", {
          lobbyId,
          round: lobby.gameState.currentRound,
          songId: selectedSong.id,
          songName: selectedSong.name,
          hasPlaylist: !!lobby.gameState.playlist,
          timestamp: new Date().toISOString(),
        });

        // Save the updated lobby state
        lobbies.set(lobbyId, lobby);

        // Emit complete game state
        io.to(lobbyId).emit("gameState", {
          ...lobby.gameState,
          hostId: lobby.hostId,
          spotifyToken: lobby.spotifyToken,
          playlist: lobby.gameState.playlist,
          currentSong: {
            id: selectedSong.id,
            name: selectedSong.name,
            duration: roundDuration,
            startTime: serverTime,
          },
        });
      } catch (error) {
        console.error("🔴 Error starting round:", error);
        socket.emit("error", "Failed to start round");
      }
    });

    // Add this function to handle round end logic
    function handleRoundEnd(io, lobby) {
      console.log("🟢 Handling round end:", {
        lobbyId: lobby.id,
        currentRound: lobby.gameState.currentRound,
        timestamp: new Date().toISOString(),
      });

      // Update game state
      lobby.gameState = {
        ...lobby.gameState,
        isPlaying: false,
        currentSong: undefined,
        snippetDuration: 500, // Reset duration to default
        currentRound: (lobby.gameState.currentRound || 1) + 1,
      };

      // Reset player states for next round
      lobby.players.forEach((p) => {
        p.hasGuessedCorrectly = false;
      });

      // Save updated state
      lobbies.set(lobby.id, lobby);

      // Emit round end
      io.to(lobby.id).emit("roundEnd", {
        correctSong: lobby.gameState.currentSong,
        nextRound: lobby.gameState.currentRound,
      });

      // Emit final game state for the round
      io.to(lobby.id).emit("gameState", {
        ...lobby.gameState,
        players: lobby.players.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          score: p.score || 0,
          isHost: p.isHost,
          hasGuessedCorrectly: false,
        })),
        hostId: lobby.hostId,
      });
    }

    // Add handler for round end
    socket.on("endRound", function ({ lobbyId }) {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || !lobby.gameState || socket.handshake.auth.userId !== lobby.hostId) return;

      console.log("🟢 Host ended round:", {
        lobbyId,
        currentRound: lobby.gameState.currentRound,
        timestamp: new Date().toISOString(),
      });

      handleRoundEnd(io, lobby);
    });
    // Add cleanup for gameUsedSongs when game ends
    socket.on("endGame", function (_a) {
      var lobbyId = _a.lobbyId;
      gameUsedSongs.delete(lobbyId);
    });
    // Update the submitGuess handler
    socket.on("submitGuess", ({ lobbyId, songName }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby?.gameState) return;

      const player = lobby.players.find(
        (p) => p.userId === socket.handshake.auth.userId
      );
      if (!player || player.hasGuessedCorrectly) return;

      const isCorrect = normalizeString(songName) === normalizeString(lobby.gameState.currentSong.name);
      
      // Calculate points based on both duration and time elapsed
      let points = 0;
      if (isCorrect) {
        const currentDuration = lobby.gameState.snippetDuration || 500;
        const timeElapsed = Date.now() - lobby.gameState.currentSong.startTime;
        
        // Base points calculation
        const basePoints = 1000;
        // Deduct 25 points for each 500ms increase in snippet duration
        const durationPenalty = Math.floor((currentDuration - 500) / 500) * 25;
        // Deduct 5 points for every 2 seconds elapsed
        const timePenalty = Math.floor(timeElapsed / 2000) * 5;
        
        points = Math.max(100, basePoints - durationPenalty - timePenalty);
        
        player.hasGuessedCorrectly = true;
        player.score = (player.score || 0) + points;

        console.log("🟢 Score calculation:", {
          basePoints,
          currentDuration,
          timeElapsed: timeElapsed / 1000, // Log in seconds for readability
          durationPenalty,
          timePenalty,
          finalPoints: points,
          timestamp: new Date().toISOString(),
        });
      }

      const guessResult = {
        playerId: player.userId,
        playerName: player.name,
        correct: isCorrect,
        points: points,
        guess: isCorrect ? "Correct!" : "Incorrect",
        timeElapsed: isCorrect ? Date.now() - lobby.gameState.currentSong.startTime : undefined,
        timestamp: Date.now(),
      };

      // Ensure all players are in the room
      lobby.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.join(lobbyId);
        }
      });

      // Create updated game state
      const updatedGameState = {
        ...lobby.gameState,
        currentSong: lobby.gameState.currentSong,
        playlist: lobby.gameState.playlist,
        hostId: lobby.hostId,
        spotifyToken: lobby.spotifyToken,
        players: lobby.players.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          score: p.score || 0,
          isHost: p.isHost,
          hasGuessedCorrectly: p.hasGuessedCorrectly,
        })),
      };

      // Log room members before broadcasting
      const roomMembers = Array.from(io.sockets.adapter.rooms.get(lobbyId) || []);
      console.log("🔍 Room members before broadcast:", {
        lobbyId,
        members: roomMembers,
        playerIds: lobby.players.map(p => p.id),
        timestamp: new Date().toISOString(),
      });

      // Broadcast events to all players
      io.to(lobbyId).emit("guessResult", guessResult);
      io.to(lobbyId).emit("gameState", updatedGameState);

      // Check for round completion
      if (isCorrect) {
        const allGuessedCorrectly = lobby.players.every(
          (p) => p.hasGuessedCorrectly
        );
        if (allGuessedCorrectly) {
          console.log("🟢 All players guessed correctly - ending round");
          handleRoundEnd(io, lobby);
        }
      }
    });
    // Add handler for duration extension
    socket.on("extendDuration", ({ lobbyId, newDuration }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby?.gameState || socket.handshake.auth.userId !== lobby.hostId) return;

      console.log("🟡 Extending snippet duration:", {
        lobbyId,
        oldDuration: lobby.gameState.snippetDuration,
        newDuration,
        timestamp: new Date().toISOString(),
      });

      // Update the game state with new duration
      lobby.gameState.snippetDuration = newDuration;
      lobbies.set(lobbyId, lobby);

      // Broadcast updated game state to all players
      io.to(lobbyId).emit("gameState", {
        ...lobby.gameState,
        players: lobby.players.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          score: p.score || 0,
          isHost: p.isHost,
          hasGuessedCorrectly: p.hasGuessedCorrectly,
        })),
      });
    });
  });
  return io;
}

// Add this function to help manage room membership
function ensurePlayersInRoom(io, lobby) {
  console.log("🔍 Ensuring players are in room:", {
    lobbyId: lobby.id,
    players: lobby.players.map(p => ({
      id: p.id,
      name: p.name,
      socketId: io.sockets.sockets.get(p.id)?.id
    })),
    timestamp: new Date().toISOString(),
  });

  lobby.players.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.id);
    if (playerSocket) {
      playerSocket.join(lobby.id);
    }
  });
}
