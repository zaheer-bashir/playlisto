import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserId } from './useUserId';

export function useSocket(url: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userId = useUserId();

  useEffect(() => {
    console.log("🟡 Initializing socket connection:", {
      url,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Create socket with auth
    const newSocket = io(url, {
      auth: { userId },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("🟢 Socket connected:", {
        socketId: newSocket.id,
        userId,
        timestamp: new Date().toISOString(),
      });
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", {
        socketId: newSocket.id,
        userId,
        timestamp: new Date().toISOString(),
      });
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      console.log("🟡 Cleaning up socket connection:", {
        socketId: newSocket.id,
        timestamp: new Date().toISOString(),
      });
      newSocket.disconnect();
    };
  }, [url, userId]);

  return { socket, isConnected };
} 