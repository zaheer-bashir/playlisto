import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserId } from './useUserId';

export function useSocket(url: string): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const userId = useUserId();

  useEffect(() => {
    if (!userId) return;

    const socketInstance = io(url, {
      auth: {
        userId: userId // Send userId with the initial connection
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, [url, userId]);

  return socket;
} 