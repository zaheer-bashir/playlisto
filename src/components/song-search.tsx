"use client";

import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, Loader2 } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedQuery.trim() || !spotifyToken) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(debouncedQuery)}&type=track&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${spotifyToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch suggestions');

        const data = await response.json();
        const formattedSuggestions: Song[] = data.tracks.items.map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => artist.name),
          album: track.album.name
        }));

        setSuggestions(formattedSuggestions);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, spotifyToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (songName: string) => {
    onGuess(songName);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search for a song..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            disabled={disabled}
            className="pr-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        <Button
          onClick={() => handleSubmit(query)}
          disabled={!query.trim() || disabled}
        >
          <Search className="h-4 w-4 mr-2" />
          Guess
        </Button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((song) => (
            <button
              key={song.id}
              className="w-full px-4 py-2 text-left hover:bg-muted flex flex-col gap-1"
              onClick={() => handleSubmit(song.name)}
            >
              <span className="font-medium">{song.name}</span>
              <span className="text-sm text-muted-foreground">
                {song.artists.join(', ')} • {song.album}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 