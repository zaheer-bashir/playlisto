"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { Pause, Play, Plus, SkipForward } from "lucide-react";
import { Loader2 } from "lucide-react";

interface AudioPlayerProps {
  songId: string;
  duration: number;
  onPlaybackComplete: () => void;
  isHost: boolean;
  onExtendDuration: () => void;
  onSkipRound: () => void;
  spotifyToken: string;
  showControls?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  songId,
  duration,
  onPlaybackComplete,
  isHost,
  onExtendDuration,
  onSkipRound,
  spotifyToken,
  showControls = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const playbackTimeout = useRef<NodeJS.Timeout>();
  const sdkReady = useRef(false);
  const initializationTimeout = useRef<NodeJS.Timeout>();

  // Initialize Spotify SDK script
  useEffect(() => {
    if (!showControls || !spotifyToken) return;

    // Check if script is already loaded
    if (!window.Spotify && !document.getElementById('spotify-player')) {
      console.log('🟡 Loading Spotify SDK script...');
      const script = document.createElement("script");
      script.id = 'spotify-player';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;

      // Add load error handling
      script.onerror = () => {
        console.error('🔴 Failed to load Spotify SDK script');
        setError('Failed to load Spotify player');
        setIsLoading(false);
      };

      document.body.appendChild(script);
    }

    // Set timeout for SDK initialization
    initializationTimeout.current = setTimeout(() => {
      if (!sdkReady.current) {
        console.error('🔴 Spotify SDK initialization timeout');
        setError('Failed to initialize Spotify player. Please refresh the page.');
        setIsLoading(false);
      }
    }, 15000); // Increased to 15 seconds

    return () => {
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }
    };
  }, [showControls, spotifyToken]);

  // Initialize Player when SDK is ready
  useEffect(() => {
    if (!showControls || !spotifyToken || sdkReady.current) return;

    const initializePlayer = () => {
      console.log("🟡 Initializing Spotify player...");
      const player = new window.Spotify.Player({
        name: "Playlisto Game Player",
        getOAuthToken: (cb) => {
          cb(spotifyToken);
        },
      });

      player.addListener("ready", ({ device_id }) => {
        console.log("🟢 Spotify Player Ready:", {
          deviceId: device_id,
          timestamp: new Date().toISOString(),
        });
        sdkReady.current = true;
        setDeviceId(device_id);
        setIsLoading(false);
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
        }
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.log("🔴 Device has gone offline:", device_id);
        setDeviceId(null);
      });

      player.addListener("initialization_error", ({ message }) => {
        console.error("🔴 Initialization error:", message);
        setError(`Initialization failed: ${message}`);
        setIsLoading(false);
      });

      player.addListener("authentication_error", ({ message }) => {
        console.error("🔴 Authentication error:", message);
        setError("Authentication failed");
        setIsLoading(false);
      });

      player.addListener("account_error", ({ message }) => {
        console.error("🔴 Account error:", message);
        setError("Premium account required");
        setIsLoading(false);
      });

      player.addListener("player_state_changed", (state) => {
        if (state) {
          setIsPlaying(!state.paused);
        }
      });

      player.connect().then((success) => {
        if (success) {
          console.log("🟢 Spotify player connected successfully");
        } else {
          console.error("🔴 Failed to connect Spotify player");
          setError("Failed to connect player");
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
        console.log("🟡 Disconnecting Spotify player...");
        player.disconnect();
      }
    };
  }, [showControls, spotifyToken]);

  // Modified play function to handle snippet playback with compensation for delay
  const playSnippet = async () => {
    if (!deviceId || !songId || !spotifyToken) return;

    try {
      // Stop any existing playback
      if (playbackTimeout.current) {
        clearTimeout(playbackTimeout.current);
      }
      if (isPlaying) {
        await player?.pause();
      }

      // Start a timestamp to measure actual playback start
      const startTime = Date.now();

      // Transfer playback to our device first
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false,
        }),
      });

      // Start playing from the beginning
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: [`spotify:track:${songId}`],
            position_ms: 0,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to play song: ${response.status}`);
      }

      setIsPlaying(true);

      // Calculate the actual delay in starting playback
      const actualDelay = Date.now() - startTime;

      // Adjust the duration to compensate for the delay
      const adjustedDuration = duration + actualDelay;

      console.log("🟡 Playback timing:", {
        requestedDuration: duration,
        actualDelay,
        adjustedDuration,
        timestamp: new Date().toISOString(),
      });

      // Set timeout to stop playback after adjusted duration
      playbackTimeout.current = setTimeout(async () => {
        await player?.pause();
        setIsPlaying(false);
      }, adjustedDuration);
    } catch (error) {
      console.error("🔴 Error playing song:", {
        songId,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
      setError("Failed to play song");
    }
  };

  // Cleanup on unmount or songId change
  useEffect(() => {
    return () => {
      if (playbackTimeout.current) {
        clearTimeout(playbackTimeout.current);
      }
      player?.pause();
    };
  }, [songId, player]);

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
            onClick={playSnippet}
            disabled={!player || !deviceId || isPlaying}
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onExtendDuration}
            disabled={isPlaying}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={onSkipRound}
            disabled={isPlaying}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {(duration / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  );
};
