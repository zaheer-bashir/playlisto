"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Pause, Play } from 'lucide-react';

interface AudioPlayerProps {
  previewUrl: string;
  duration: number;
  onPlaybackComplete?: () => void;
  isHost?: boolean;
  onExtendDuration?: () => void;
}

export function AudioPlayer({ 
  previewUrl, 
  duration, 
  onPlaybackComplete,
  isHost,
  onExtendDuration 
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(duration);

  useEffect(() => {
    const audio = new Audio(previewUrl);
    audioRef.current = audio;

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handlePlaybackComplete);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handlePlaybackComplete);
      audio.pause();
      audioRef.current = null;
    };
  }, [previewUrl]);

  useEffect(() => {
    setMaxDuration(duration);
  }, [duration]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime * 1000); // Convert to milliseconds

    // Stop playback if we've reached the current duration limit
    if (audio.currentTime * 1000 >= maxDuration) {
      audio.pause();
      setIsPlaying(false);
      handlePlaybackComplete();
    }
  };

  const handlePlaybackComplete = () => {
    setIsPlaying(false);
    onPlaybackComplete?.();
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Reset to start if we've reached the duration limit
      if (currentTime >= maxDuration) {
        audio.currentTime = 0;
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleExtend = () => {
    onExtendDuration?.();
  };

  // Calculate progress percentage
  const progress = Math.min((currentTime / maxDuration) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlayback}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {isHost && (
          <Button
            variant="outline"
            onClick={handleExtend}
            disabled={!isPlaying}
          >
            Extend (+0.5s)
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        {(currentTime / 1000).toFixed(1)}s / {(maxDuration / 1000).toFixed(1)}s
      </div>
    </div>
  );
} 