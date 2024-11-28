import { useEffect, useRef, useState } from 'react';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isPreloading: boolean;
}

export function useAudioPlayer() {
  const audioContext = useRef<AudioContext | null>(null);
  const audioBuffer = useRef<AudioBuffer | null>(null);
  const sourceNode = useRef<AudioBufferSourceNode | null>(null);
  const startTime = useRef<number>(0);
  const nextAudioBuffer = useRef<AudioBuffer | null>(null);
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isPreloading: false
  });

  useEffect(() => {
    audioContext.current = new AudioContext();
    return () => {
      audioContext.current?.close();
    };
  }, []);

  const loadAudio = async (url: string): Promise<void> => {
    if (!audioContext.current) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer.current = await audioContext.current.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const preloadNext = async (url: string) => {
    if (!audioContext.current) return;
    try {
      setPlayerState(prev => ({ ...prev, isPreloading: true }));
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      nextAudioBuffer.current = await audioContext.current.decodeAudioData(arrayBuffer);
      setPlayerState(prev => ({ ...prev, isPreloading: false }));
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  };

  const play = (duration: number, serverTime: number) => {
    if (!audioContext.current || !audioBuffer.current) return;

    // Stop any existing playback
    stop();

    // Calculate network latency compensation
    const latency = Date.now() - serverTime;
    
    sourceNode.current = audioContext.current.createBufferSource();
    sourceNode.current.buffer = audioBuffer.current;
    sourceNode.current.connect(audioContext.current.destination);

    startTime.current = audioContext.current.currentTime;
    sourceNode.current.start(0, 0, duration / 1000); // Convert ms to seconds

    setPlayerState({
      isPlaying: true,
      currentTime: 0,
      duration,
      isPreloading: false
    });

    // Schedule stop
    setTimeout(() => {
      stop();
    }, duration - latency);
  };

  const extend = (newDuration: number, serverTime: number) => {
    if (!sourceNode.current || !audioContext.current) return;

    const latency = Date.now() - serverTime;
    const currentDuration = playerState.duration;
    
    // Schedule the extension
    setTimeout(() => {
      if (sourceNode.current && audioContext.current) {
        sourceNode.current.stop();
        
        // Create new source for extended playback
        sourceNode.current = audioContext.current.createBufferSource();
        sourceNode.current.buffer = audioBuffer.current;
        sourceNode.current.connect(audioContext.current.destination);
        
        // Calculate where to resume from
        const elapsed = audioContext.current.currentTime - startTime.current;
        sourceNode.current.start(0, elapsed, (newDuration - currentDuration) / 1000);
        
        setPlayerState(prev => ({
          ...prev,
          duration: newDuration
        }));
      }
    }, currentDuration - latency);
  };

  const stop = () => {
    if (sourceNode.current) {
      sourceNode.current.stop();
      sourceNode.current.disconnect();
      sourceNode.current = null;
    }
    setPlayerState(prev => ({
      ...prev,
      isPlaying: false
    }));
  };

  return {
    loadAudio,
    play,
    stop,
    extend,
    playerState
  };
} 