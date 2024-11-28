"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
var socket_io_1 = require("socket.io");
var lobbies = new Map();
var socketToLobbyMap = new Map();
var userSocketMap = new Map();
var gameUsedSongs = new Map();
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
    socket.on("requestGameState", function (_a) {
      var gameId = _a.gameId,
        userId = _a.userId;

      console.log("🟡 Game state requested:", {
        gameId,
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      var lobby = lobbies.get(gameId);
      if (!lobby?.gameState) {
        console.log("🔴 No game state found:", { gameId });
        return;
      }

      // Send complete game state including playlist and current song
      socket.emit("gameState", {
        ...lobby.gameState,
        hostId: lobby.hostId,
        spotifyToken: lobby.spotifyToken,
        playlist: lobby.gameState.playlist,
        currentSong: lobby.gameState.currentSong,
      });

      console.log("🟢 Sent game state:", {
        gameId,
        hasPlaylist: !!lobby.gameState.playlist,
        hasSong: !!lobby.gameState.currentSong,
        songId: lobby.gameState.currentSong?.id,
        timestamp: new Date().toISOString(),
      });
    });
    // Update the startRound handler
    socket.on("startRound", function (_a) {
      var lobbyId = _a.lobbyId;
      var lobby = lobbies.get(lobbyId);

      console.log("🟡 Starting round - checking playlist:", {
        hasGameState: !!lobby?.gameState,
        hasPlaylist: !!lobby?.gameState?.playlist,
        totalTracks: lobby?.gameState?.playlist?.tracks?.items?.length || 0,
        timestamp: new Date().toISOString(),
      });

      if (!lobby?.gameState?.playlist?.tracks?.items) {
        console.log("🔴 No playlist tracks available");
        socket.emit("error", "No playlist tracks available");
        return;
      }

      try {
        // Get all available tracks
        const availableTracks = lobby.gameState.playlist.tracks.items
          .filter((item) => item.track)
          .map((item) => item.track);

        // Get unused tracks
        const usedSongs = gameUsedSongs.get(lobbyId) || new Set();
        const availableSongs = availableTracks.filter(
          (track) => !usedSongs.has(track.id)
        );

        console.log("🟡 Available songs for round:", {
          totalTracks: availableTracks.length,
          available: availableSongs.length,
          used: usedSongs.size,
          timestamp: new Date().toISOString(),
        });

        if (availableSongs.length === 0) {
          console.log("🔴 All songs have been used");
          socket.emit(
            "error",
            "All available songs have been used. Game complete!"
          );
          return;
        }

        // Select random song
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const selectedSong = availableSongs[randomIndex];

        const serverTime = Date.now();
        const roundDuration = 30000; // 30 seconds

        // Update game state with complete song data
        lobby.gameState = {
          ...lobby.gameState,
          isPlaying: true,
          currentSong: {
            id: selectedSong.id,
            name: selectedSong.name,
            duration: roundDuration,
            startTime: serverTime,
          },
          playlist: lobby.gameState.playlist, // Ensure playlist is included
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

    // Add handler for round end
    socket.on("endRound", function (_a) {
      var lobbyId = _a.lobbyId;
      var lobby = lobbies.get(lobbyId);
      if (!lobby || !lobby.gameState) return;

      console.log("🟡 Ending round:", {
        lobbyId,
        round: lobby.gameState.currentRound,
        timestamp: new Date().toISOString(),
      });

      // Update game state
      lobby.gameState.isPlaying = false;
      lobby.gameState.currentSong = undefined;
      lobby.gameState.currentRound += 1;

      // Save updated state
      lobbies.set(lobbyId, lobby);

      // Emit updated game state
      io.to(lobbyId).emit("gameState", lobby.gameState);
      io.to(lobbyId).emit("roundEnd", {
        correctSong: lobby.gameState.correctSong,
        nextRound: lobby.gameState.currentRound,
      });
    });
    // Add cleanup for gameUsedSongs when game ends
    socket.on("endGame", function (_a) {
      var lobbyId = _a.lobbyId;
      gameUsedSongs.delete(lobbyId);
    });
    // When handling a correct guess:
    socket.on('submitGuess', ({ lobbyId, guess, snippetDuration }) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (!player) return;

      const isCorrect =
        guess.toLowerCase() ===
        lobby.gameState?.currentSong?.name?.toLowerCase();
      
      if (isCorrect) {
        // Calculate points based on snippet duration
        // Example: 1000 points at 0.5s, decreasing by 100 points for each additional 0.5s
        const basePoints = 1000;
        const pointsDeduction = Math.floor((snippetDuration - 500) / 500) * 100;
        const points = Math.max(100, basePoints - pointsDeduction);

        player.score += points;
        
        // Emit guess result
        io.to(lobbyId).emit('guessResult', {
          playerId: player.id,
          playerName: player.name,
          correct: true,
          points,
          guess
        });

        // Check if all players have guessed correctly
        const allGuessedCorrectly = lobby.players.every(p => p.hasGuessedCorrectly);
        if (allGuessedCorrectly) {
          // End the round automatically
          endRound(lobbyId);
        }
      }
    });
  });
  return io;
}
