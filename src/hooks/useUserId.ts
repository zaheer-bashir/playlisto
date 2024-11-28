import { useState, useEffect } from 'react';

export function useUserId() {
    const [userId, setUserId] = useState<string | null>(() => {
        // Try to get from localStorage first
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userId');
        }
        return null;
    });

    useEffect(() => {
        if (!userId) {
            // Generate new userId if none exists
            const newUserId = crypto.randomUUID();
            setUserId(newUserId);
            localStorage.setItem('userId', newUserId);
            console.log('🟢 Generated new userId:', {
                userId: newUserId,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('🟢 Using existing userId:', {
                userId,
                timestamp: new Date().toISOString()
            });
        }
    }, []);

    return userId;
} 