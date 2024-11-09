"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SpotifyCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract access token and state from URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const error = params.get('error');
        const state = params.get('state');

        if (error) {
          console.error('Spotify auth error:', error);
          router.replace('/');
          return;
        }

        if (accessToken && state) {
          try {
            // Decode the state parameter
            const decodedState = JSON.parse(atob(state));
            const returnPath = decodedState.returnPath;

            // Construct the return URL with the token
            const returnUrl = new URL(returnPath, window.location.origin);
            returnUrl.searchParams.append('spotify_token', accessToken);
            
            // Redirect back to the original page
            router.replace(returnUrl.toString());
          } catch (error) {
            console.error('Error parsing state:', error);
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      } catch (error) {
        console.error('Error in callback:', error);
        router.replace('/');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Connecting to Spotify...</p>
    </div>
  );
} 