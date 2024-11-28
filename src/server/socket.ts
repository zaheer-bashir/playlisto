import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Player, Lobby } from '@/types/game';

const lobbies = new Map<string, Lobby>();
const socketToLobbyMap = new Map<string, string>();
const userSocketMap = new Map<string, string>();

const logHostChange = (message: string, data: {
  lobbyId: string,
  userId: string,
  oldIsHost?: boolean,
  newIsHost: boolean,
  reason: string
}) => {
  console.log(`[HOST CHANGE] ${message}`, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export function initializeSocketServer(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connect', (socket) => {
    const userId = socket.handshake.auth.userId;

    socket.on('joinLobby', ({ lobbyId, playerName, isHost, userId }) => {
      const lobby = lobbies.get(lobbyId);
      const existingPlayer = lobby?.players.find(p => p.userId === userId);

      if (existingPlayer) {
        existingPlayer.id = socket.id;
        if (lobby && userId === lobby.hostUserId) {
          existingPlayer.isHost = true;
          logHostChange('Maintaining host status', {
            lobbyId, userId, newIsHost: true, reason: 'reconnection'
          });
        }
        
        socketToLobbyMap.set(socket.id, lobbyId);
        userSocketMap.set(userId, socket.id);
        socket.join(lobbyId);
        io.to(lobbyId).emit('lobbyUpdate', lobby);
        return;
      }

      if (isHost && lobby?.hostUserId && lobby.hostUserId !== userId) {
        socket.emit('error', 'Lobby already has a host');
        return;
      }

      const player: Player = {
        id: socket.id,
        userId,
        name: playerName,
        isReady: isHost,
        isHost,
        score: 0
      };

      if (!lobby) {
        lobbies.set(lobbyId, {
          id: lobbyId,
          players: [player],
          hostUserId: isHost ? userId : undefined
        });
      } else {
        lobby.players.push(player);
        lobbies.set(lobbyId, lobby);
      }

      socketToLobbyMap.set(socket.id, lobbyId);
      userSocketMap.set(userId, socket.id);
      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
    });

    socket.on('disconnect', () => {
      const lobbyId = socketToLobbyMap.get(socket.id);
      if (!lobbyId) return;

      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const disconnectedPlayer = lobby.players.find(p => p.id === socket.id);
      if (!disconnectedPlayer) return;

      setTimeout(() => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        const hasReconnected = Array.from(userSocketMap.entries())
          .some(([uid, _]) => uid === disconnectedPlayer.userId);

        if (!hasReconnected) {
          lobby.players = lobby.players.filter(p => p.userId !== disconnectedPlayer.userId);

          if (lobby.players.length === 0) {
            lobbies.delete(lobbyId);
          } else if (disconnectedPlayer.userId === lobby.hostUserId) {
            const newHost = lobby.players[0];
            newHost.isHost = true;
            newHost.isReady = true;
            lobby.hostUserId = newHost.userId;
            lobbies.set(lobbyId, lobby);
            io.to(lobbyId).emit('lobbyUpdate', lobby);
          } else {
            lobbies.set(lobbyId, lobby);
            io.to(lobbyId).emit('lobbyUpdate', lobby);
          }
        }
        socketToLobbyMap.delete(socket.id);
      }, 5000);
    });
  });

  return io;
}