import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserId } from './useUserId';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
}

export function useSocket(url: string): { socket: Socket | null; isConnected: boolean } {
  const [socketState, setSocketState] = useState<SocketState>({ socket: null, isConnected: false });
  const userId = useUserId();

  useEffect(() => {
    if (!userId) {
      console.log('🔴 No userId available for socket connection');
      return;
    }

    console.log('🟡 Initializing socket connection:', {
      userId,
      url,
      timestamp: new Date().toISOString()
    });

    const socketInstance = io(url, {
      auth: { userId },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: false,
      multiplex: true
    });

    socketInstance.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', {
        error: error.message,
        userId,
        timestamp: new Date().toISOString()
      });
    });

    socketInstance.on('connect', () => {
      console.log('🟢 Socket connected:', {
        socketId: socketInstance.id,
        userId,
        timestamp: new Date().toISOString()
      });
      setSocketState({ socket: socketInstance, isConnected: true });
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', {
        reason,
        userId,
        timestamp: new Date().toISOString()
      });
      setSocketState(prev => ({ ...prev, isConnected: false }));
    });

    return () => {
      console.log('🟡 Cleaning up socket connection:', {
        socketId: socketInstance.id,
        userId,
        timestamp: new Date().toISOString()
      });
      socketInstance.close();
    };
  }, [url, userId]);

  return socketState;
} 