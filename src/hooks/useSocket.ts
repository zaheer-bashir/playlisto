import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(url: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!url || isConnecting) return;

    setIsConnecting(true);
    
    try {
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true
      });

      socket.on('connect', () => {
        console.log('Socket connected successfully');
        setIsConnecting(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnecting(false);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      socketRef.current = socket;

      return () => {
        socket.removeAllListeners();
        socket.close();
        socketRef.current = null;
        setIsConnecting(false);
      };
    } catch (error) {
      console.error('Socket initialization error:', error);
      setIsConnecting(false);
    }
  }, [url]);

  return socketRef.current;
} 