"use client";

import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, Loader2, Music } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface Song {
  id: string;
  name: string;
  artists: string[];
  album: string;
}

interface SongSearchProps {
  spotifyToken: string;
  onGuess: (guess: string) => void;
  disabled?: boolean;
}

export function SongSearch({ spotifyToken, onGuess, disabled }: SongSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Search songs when debounced search term changes
  useEffect(() => {
    if (!debouncedSearchTerm.trim() || !spotifyToken) {
      setResults([]);
      return;
    }

    const searchSongs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            debouncedSearchTerm
          )}&type=track&limit=5`,
          {
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Spotify token has expired');
          }
          throw new Error('Failed to search songs');
        }

        const data = await response.json();
        
        const formattedResults: Song[] = data.tracks.items.map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => artist.name),
          album: track.album.name,
        }));

        setResults(formattedResults);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    searchSongs();
  }, [debouncedSearchTerm, spotifyToken]);

  const handleSubmitGuess = (songName: string) => {
    onGuess(songName);
    setSearchTerm('');
    setResults([]);
    setShowResults(false);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowResults(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search for a song..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            disabled={disabled}
            className="pr-10"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showResults && (searchTerm || results.length > 0) && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
          {error ? (
            <div className="p-2 text-sm text-destructive">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">
              {isLoading ? 'Searching...' : 'No songs found'}
            </div>
          ) : (
            <ul className="max-h-[300px] overflow-auto">
              {results.map((song) => (
                <li
                  key={song.id}
                  className="border-b last:border-0"
                >
                  <button
                    onClick={() => handleSubmitGuess(song.name)}
                    className="w-full px-4 py-2 text-left hover:bg-muted flex items-start gap-3 transition-colors"
                    disabled={disabled}
                  >
                    <Music className="h-4 w-4 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{song.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {song.artists.join(', ')}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
} 