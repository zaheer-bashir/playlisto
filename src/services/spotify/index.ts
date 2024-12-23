import { Playlist } from "@/types/lobby";
import { SPOTIFY_API_URL } from "@/utils/constants";

interface SpotifyService {
  getPlaylists: () => Promise<Playlist[]>;
  getPlaylistDetails: (playlistId: string) => Promise<Playlist>;
  searchTracks: (query: string) => Promise<any>;
}

export const createSpotifyService = (token: string): SpotifyService => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return {
    async getPlaylists() {
      const response = await fetch(
        `${SPOTIFY_API_URL}/me/playlists?limit=50`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch playlists");
      }

      const data = await response.json();
      return data.items
        .filter((item: any) => item && item.tracks)
        .map((item: any) => ({
          id: item.id,
          name: item.name || "Unnamed Playlist",
          tracks: item.tracks.total || 0,
          imageUrl: item.images?.[0]?.url || null,
        }));
    },

    async getPlaylistDetails(playlistId: string) {
      const response = await fetch(
        `${SPOTIFY_API_URL}/playlists/${playlistId}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch playlist details");
      }

      return response.json();
    },

    async searchTracks(query: string) {
      const response = await fetch(
        `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(
          query
        )}&type=track&limit=5`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to search tracks");
      }

      return response.json();
    },
  };
};
