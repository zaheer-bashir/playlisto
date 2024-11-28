"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { Pause, Play, Plus } from "lucide-react";
import { Loader2 } from "lucide-react";

interface AudioPlayerProps {
  songId: string;
  duration: number;
  onPlaybackComplete: () => void;
  isHost: boolean;
  onExtendDuration: () => void;
  autoPlay?: boolean;
  spotifyToken: string;
  showControls?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  songId,
  duration,
  onPlaybackComplete,
  isHost,
  onExtendDuration,
  autoPlay = false,
  spotifyToken,
  showControls = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const initializationTimeout = useRef<NodeJS.Timeout>();
  const sdkReady = useRef(false);

  // Initialize Spotify SDK script
  useEffect(() => {
    if (!showControls) return;

    // Check if script is already loaded
    if (!window.Spotify && !document.getElementById('spotify-player')) {
      console.log('🟡 Loading Spotify SDK script...');
      const script = document.createElement("script");
      script.id = 'spotify-player';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    // Set timeout for SDK initialization
    initializationTimeout.current = setTimeout(() => {
      if (!sdkReady.current) {
        console.error('🔴 Spotify SDK initialization timeout');
        setError('Failed to initialize Spotify player');
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }
    };
  }, [showControls]);

  // Initialize Player when SDK is ready
  useEffect(() => {
    if (!showControls || !spotifyToken || sdkReady.current) return;

    const initializePlayer = () => {
      console.log('🟡 Initializing Spotify player...');
      const player = new window.Spotify.Player({
        name: 'Playlisto Game Player',
        getOAuthToken: cb => { cb(spotifyToken); }
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('🟢 Spotify Player Ready:', {
          deviceId: device_id,
          timestamp: new Date().toISOString()
        });
        sdkReady.current = true;
        setDeviceId(device_id);
        setIsLoading(false);
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
        }
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('🔴 Device has gone offline:', device_id);
        setDeviceId(null);
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('🔴 Initialization error:', message);
        setError(`Initialization failed: ${message}`);
        setIsLoading(false);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('🔴 Authentication error:', message);
        setError('Authentication failed');
        setIsLoading(false);
      });

      player.addListener('account_error', ({ message }) => {
        console.error('🔴 Account error:', message);
        setError('Premium account required');
        setIsLoading(false);
      });

      player.addListener('player_state_changed', state => {
        if (state) {
          setIsPlaying(!state.paused);
        }
      });

      player.connect()
        .then(success => {
          if (success) {
            console.log('🟢 Spotify player connected successfully');
          } else {
            console.error('🔴 Failed to connect Spotify player');
            setError('Failed to connect player');
            setIsLoading(false);
          }
        });

      setPlayer(player);
    };

    if (window.Spotify) {
      initializePlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
    }

    return () => {
      if (player) {
        console.log('🟡 Disconnecting Spotify player...');
        player.disconnect();
      }
    };
  }, [showControls, spotifyToken]);

  // Play the song when deviceId and songId are available
  useEffect(() => {
    if (!deviceId || !songId || !spotifyToken) return;

    const playSong = async () => {
      try {
        // Transfer playback to our device first
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${spotifyToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false
          })
        });

        // Then start playing
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${spotifyToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uris: [`spotify:track:${songId}`]
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to play song: ${response.status}`);
        }

        if (autoPlay) {
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('🔴 Error playing song:', {
          songId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        setError('Failed to play song');
      }
    };

    playSong();
  }, [deviceId, songId, spotifyToken, autoPlay]);

  // Handle playback control
  const togglePlayback = async () => {
    if (!player) return;

    if (isPlaying) {
      await player.pause();
    } else {
      await player.resume();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle duration and completion
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (onPlaybackComplete) {
        player?.pause();
        setIsPlaying(false);
        onPlaybackComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [isPlaying, duration, onPlaybackComplete, player]);

  // Only render controls if showControls is true
  if (!showControls) {
    return null;
  }

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex items-center justify-center h-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">
            Initializing player...
          </span>
        </div>
      ) : error ? (
        <div className="text-destructive text-sm">{error}</div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={isPlaying ? "secondary" : "default"}
            onClick={togglePlayback}
            disabled={!player || !deviceId}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          {isHost && onExtendDuration && (
            <Button size="icon" variant="outline" onClick={onExtendDuration}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
