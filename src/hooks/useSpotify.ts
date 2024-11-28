import { useEffect, useState } from 'react';

interface SpotifyApi {
  getPlaylist: (playlistId: string) => Promise<any>;
  searchTracks: (query: string) => Promise<any>;
}

export function useSpotify(token: string | null): SpotifyApi | null {
  const [api, setApi] = useState<SpotifyApi | null>(null);

  useEffect(() => {
    if (!token) {
      setApi(null);
      return;
    }

    const spotifyApi: SpotifyApi = {
      getPlaylist: async (playlistId: string) => {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      },

      searchTracks: async (query: string) => {
        const response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, 
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      }
    };

    setApi(spotifyApi);
  }, [token]);

  return api;
} 