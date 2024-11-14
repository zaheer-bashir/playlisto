import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get existing userId from localStorage
    const storedUserId = localStorage.getItem('playlisto_user_id');
    
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      // Generate new userId if none exists
      const newUserId = uuidv4();
      localStorage.setItem('playlisto_user_id', newUserId);
      setUserId(newUserId);
    }
  }, []);

  return userId;
} 