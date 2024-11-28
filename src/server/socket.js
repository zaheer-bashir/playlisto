"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
var socket_io_1 = require("socket.io");
var lobbies = new Map();
var socketToLobbyMap = new Map();
var userSocketMap = new Map();
function initializeSocketServer(server) {
    var io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    io.on('connection', function (socket) {
        var userId = socket.handshake.auth.userId;
        console.log('New socket connection:', {
            socketId: socket.id,
            userId,
            existingSocketMapping: Array.from(userSocketMap.entries())
        });
        if (userId) {
            var existingSocketId = userSocketMap.get(userId);
            if (existingSocketId) {
                console.log('Existing socket found for userId:', {
                    userId,
                    existingSocketId,
                    newSocketId: socket.id
                });
            }
            userSocketMap.set(userId, socket.id);
        }
        // Join lobby
        socket.on('joinLobby', function (_a) {
            var lobbyId = _a.lobbyId, playerName = _a.playerName, isHost = _a.isHost, userId = _a.userId;
            console.log('Join lobby request received:', {
                socketId: socket.id,
                userId,
                playerName,
                isHost,
                lobbyId,
                timestamp: new Date().toISOString()
            });
            var lobby = lobbies.get(lobbyId);
            console.log('Current lobby state:', {
                lobbyId,
                exists: !!lobby,
                playerCount: lobby?.players?.length || 0,
                players: lobby?.players?.map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.isHost
                })),
                timestamp: new Date().toISOString()
            });
            // Check for existing player with this userId
            var existingPlayer = lobby?.players.find(function (p) { return p.userId === userId; });
            console.log('temp 2:', existingPlayer);
            if (existingPlayer) {
                console.log('Found existing player:', {
                    userId,
                    existingPlayerId: existingPlayer.id,
                    newSocketId: socket.id,
                    isHost: existingPlayer.isHost
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
                console.log('Emitting lobbyUpdate:', {
                    lobbyId,
                    players: lobby?.players?.map(p => ({
                        id: p.id,
                        name: p.name,
                        isHost: p.isHost
                    })),
                    timestamp: new Date().toISOString()
                });
                io.to(lobbyId).emit('lobbyUpdate', lobby);
                return;
            }
            console.log('temp 3:', !lobby && !isHost);
            if (!lobby && !isHost) {
                socket.emit('error', 'Lobby not found');
                return;
            }
            var player = {
                id: socket.id,
                userId: userId,
                name: playerName,
                isReady: isHost,
                isHost: isHost
            };
            console.log('temp 4:', !lobby);
            if (!lobby) {
                // Create new lobby if player is host
                console.log('Creating new lobby with host:', {
                    lobbyId,
                    hostUserId: userId,
                    timestamp: new Date().toISOString()
                });
                lobbies.set(lobbyId, {
                    id: lobbyId,
                    players: [player],
                    hostId: userId
                });
            }
            else {
                // Check if player with same name already exists
                var nameExists = lobby.players.some(function (p) { return p.name === playerName && p.userId !== userId; });
                if (nameExists) {
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
            console.log('Emitting lobbyUpdate:', {
                lobbyId,
                players: lobby?.players?.map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.isHost
                })),
                timestamp: new Date().toISOString()
            });
            io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
        });
        // Toggle ready status
        socket.on('toggleReady', function (_a) {
            var lobbyId = _a.lobbyId;
            var lobby = lobbies.get(lobbyId);
            if (!lobby)
                return;
            var player = lobby.players.find(function (p) { return p.id === socket.id; });
            if (player) {
                player.isReady = !player.isReady;
                lobbies.set(lobbyId, lobby);
                io.to(lobbyId).emit('lobbyUpdate', lobby);
            }
        });
        // Update playlist selection
        socket.on('updatePlaylist', function (_a) {
            var lobbyId = _a.lobbyId, playlist = _a.playlist;
            var lobby = lobbies.get(lobbyId);
            if (!lobby)
                return;
            var player = lobby.players.find(function (p) { return p.id === socket.id; });
            if (player === null || player === void 0 ? void 0 : player.isHost) {
                lobby.spotifyPlaylist = playlist;
                lobbies.set(lobbyId, lobby);
                io.to(lobbyId).emit('lobbyUpdate', lobby);
            }
        });
        // Start game
        socket.on('startGame', function (_a) {
            var lobbyId = _a.lobbyId;
            var lobby = lobbies.get(lobbyId);
            if (!lobby) {
                console.log('Start game failed - lobby not found:', { lobbyId });
                return;
            }

            var userId = Array.from(userSocketMap.entries())
                .find(([_, socketId]) => socketId === socket.id)?.[0];

            console.log('Start game request:', {
                lobbyId,
                userId,
                hostId: lobby.hostId,
                isHost: lobby.hostId === userId,
                timestamp: new Date().toISOString()
            });

            if (lobby.hostId === userId && lobby.players.every(function (p) { return p.isReady || p.isHost; })) {
                // Initialize game state with all required fields
                const initialGameState = {
                    currentRound: 1,
                    totalRounds: 10,
                    players: lobby.players.map(player => ({
                        id: player.id,
                        userId: player.userId,
                        name: player.name,
                        score: 0,
                        isHost: player.isHost
                    })),
                    isPlaying: false,
                    hostId: lobby.hostId, // Add hostId to game state
                    spotifyPlaylist: lobby.spotifyPlaylist,
                    spotifyToken: lobby.spotifyToken
                };
                
                // Store game state in lobby
                lobby.gameState = initialGameState;
                lobbies.set(lobbyId, lobby);

                console.log('Emitting gameStart with initial state:', {
                    lobbyId,
                    gameState: initialGameState,
                    timestamp: new Date().toISOString()
                });

                // Emit gameStart with complete game data
                io.to(lobbyId).emit('gameStart', {
                    gameState: initialGameState,
                    playlist: lobby.spotifyPlaylist,
                    spotifyToken: lobby.spotifyToken
                });

                // Also emit a separate gameState event to ensure state is synchronized
                io.to(lobbyId).emit('gameState', initialGameState);
            } else {
                console.log('Start game rejected:', {
                    reason: lobby.hostId !== userId ? 'Not host' : 'Not all players ready',
                    timestamp: new Date().toISOString()
                });
            }
        });
        // Handle disconnection
        socket.on('disconnect', function () {
            console.log('Socket disconnecting:', {
                socketId: socket.id,
                rooms: Array.from(socket.rooms || []),
                timestamp: new Date().toISOString()
            });
            var foundEntry = Array.from(userSocketMap.entries())
                .find(function (entry) { return entry[1] === socket.id; });
            
            var userId = foundEntry ? foundEntry[0] : null;
            
            console.log('Socket disconnected:', {
                socketId: socket.id,
                userId,
                timestamp: new Date().toISOString()
            });

            if (userId) {
                userSocketMap.delete(userId);
            }

            var lobbyId = socketToLobbyMap.get(socket.id);
            if (lobbyId) {
                var lobby = lobbies.get(lobbyId);
                if (lobby) {
                    var disconnectedPlayer = lobby.players.find(function (p) { return p.userId === userId; });
                    if (disconnectedPlayer) {
                        setTimeout(function () {
                            var lobby = lobbies.get(lobbyId);
                            if (lobby) {
                                var hasReconnected = userSocketMap.has(userId);
                                if (!hasReconnected) {
                                    lobby.players = lobby.players.filter(function (p) { return p.userId !== userId; });
                                    if (lobby.players.length === 0) {
                                        lobbies.delete(lobbyId);
                                    } else if (lobby.hostId === userId) {
                                        var newHost = lobby.players[0];
                                        newHost.isHost = true;
                                        newHost.isReady = true;
                                        lobby.hostId = newHost.userId;
                                        console.log('Transferring host status:', {
                                            oldHostId: userId,
                                            newHostId: newHost.userId,
                                            timestamp: new Date().toISOString()
                                        });
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
        // Add logging for room joins
        socket.on('room', (room) => {
            console.log('Socket joined room:', {
                socketId: socket.id,
                room,
                timestamp: new Date().toISOString()
            });
        });
        // Add logging for socket.join
        const originalJoin = socket.join;
        socket.join = function(...args) {
            console.log('Socket joining room:', {
                socketId: socket.id,
                room: args[0],
                timestamp: new Date().toISOString()
            });
            return originalJoin.apply(this, args);
        };
        // Add error event handler
        socket.on('error', (error) => {
            console.error('Socket error:', {
                socketId: socket.id,
                error,
                timestamp: new Date().toISOString()
            });
        });
        // Add handler for game state requests
        socket.on('requestGameState', function (_a) {
            var gameId = _a.gameId, userId = _a.userId;
            
            console.log('Game state requested:', {
                gameId,
                userId,
                timestamp: new Date().toISOString()
            });

            var lobby = lobbies.get(gameId);
            if (!lobby) {
                console.log('No lobby found for game state request:', { gameId });
                socket.emit('error', 'Game not found');
                return;
            }

            // Always ensure we have a game state
            if (!lobby.gameState) {
                console.log('Initializing new game state for lobby:', { gameId });
                lobby.gameState = {
                    currentRound: 1,
                    totalRounds: 10,
                    players: lobby.players.map(player => ({
                        id: player.id,
                        userId: player.userId,
                        name: player.name,
                        score: 0,
                        isHost: player.isHost
                    })),
                    isPlaying: false,
                    hostId: lobby.hostId,
                    spotifyPlaylist: lobby.spotifyPlaylist,
                    spotifyToken: lobby.spotifyToken
                };
                lobbies.set(gameId, lobby);
            }

            // Find the player in the game
            const player = lobby.players.find(p => p.userId === userId);
            if (!player) {
                console.log('Player not found in game:', { gameId, userId });
                socket.emit('error', 'Player not found in game');
                return;
            }

            console.log('Sending game state to player:', {
                gameId,
                userId,
                isHost: player.isHost,
                gameState: lobby.gameState,
                timestamp: new Date().toISOString()
            });

            // Send complete game state
            socket.emit('gameState', {
                ...lobby.gameState,
                hostId: lobby.hostId,
                spotifyPlaylist: lobby.spotifyPlaylist,
                spotifyToken: lobby.spotifyToken
            });
        });
        // Add handler for round updates
        socket.on('startRound', function (_a) {
            var lobbyId = _a.lobbyId, song = _a.song;
            var lobby = lobbies.get(lobbyId);
            if (!lobby || !lobby.gameState) {
                console.log('Start round failed - no game state:', { lobbyId });
                return;
            }

            var userId = Array.from(userSocketMap.entries())
                .find(([_, socketId]) => socketId === socket.id)?.[0];

            if (lobby.hostId !== userId) {
                console.log('Unauthorized round start attempt:', {
                    lobbyId,
                    userId,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            const serverTime = Date.now();
            const roundDuration = 30000; // 30 seconds

            // Update game state with round information
            lobby.gameState.isPlaying = true;
            lobby.gameState.currentSong = {
                previewUrl: song.preview_url,
                duration: roundDuration,
                startTime: serverTime
            };

            console.log('Starting round:', {
                lobbyId,
                round: lobby.gameState.currentRound,
                songId: song.id,
                gameState: lobby.gameState,
                timestamp: new Date().toISOString()
            });

            lobbies.set(lobbyId, lobby);

            // Emit both round start and updated game state
            io.to(lobbyId).emit('roundStart', {
                previewUrl: song.preview_url,
                duration: roundDuration,
                serverTime
            });

            io.to(lobbyId).emit('gameState', lobby.gameState);
        });
    });
    return io;
}
