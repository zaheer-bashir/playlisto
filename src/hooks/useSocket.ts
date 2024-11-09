import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

export function useSocket(url: string) {
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!url || isConnecting || globalSocket) return;

    setIsConnecting(true);
    
    try {
      if (!globalSocket) {
        globalSocket = io(url, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: false
        });

        globalSocket.on('connect', () => {
          console.log('Socket connected successfully');
          setIsConnecting(false);
        });

        globalSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setIsConnecting(false);
        });

        globalSocket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
        });
      }
    } catch (error) {
      console.error('Socket initialization error:', error);
      setIsConnecting(false);
    }

    return () => {
      setIsConnecting(false);
    };
  }, [url]);

  return globalSocket;
} 