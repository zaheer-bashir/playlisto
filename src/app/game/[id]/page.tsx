"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioPlayer } from '@/components/audio-player';
import { SongSearch } from '@/components/song-search';
import { Loader2 } from "lucide-react";
import { Music2, Crown, Play, SkipForward, MessageSquare, Trophy, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUserId } from '@/hooks/useUserId';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

interface GameState {
  currentRound: number;
  totalRounds: number;
  players: Player[];
  currentSong?: {
    previewUrl: string;
    duration: number;
    startTime: number;
  };
  isPlaying: boolean;
  hostId?: string;
  spotifyPlaylist?: {
    id: string;
    name: string;
  };
  spotifyToken?: string;
}

interface GuessResult {
  playerId: string;
  playerName?: string;
  correct: boolean;
  points?: number;
  guess: string;
}

// Define a type for the playlist item
interface PlaylistItem {
  track: {
    preview_url?: string;
  };
}

// Define a type for the expected structure of the playlist
interface Playlist {
  id: string;
  name: string;
  tracks: {
    items: Array<{
      track: {
        id: string;
        name: string;
        preview_url?: string;
      }
    }>
  }
}

interface GameStartData {
  playlist: Playlist;
  gameState: GameState;
  spotifyToken: string;
}

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const userId = useUserId();
  const { socket, isConnected } = useSocket(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
  
  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1,
    totalRounds: 10,
    players: [],
    isPlaying: false
  });
  const [guess, setGuess] = useState('');
  const [remainingGuesses, setRemainingGuesses] = useState(3);
  const [guessResults, setGuessResults] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('Waiting for host to start the round...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<any>(null);
  const [availableSongs, setAvailableSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add a mount counter ref to track mounts
  const mountCount = useRef(0);

  // Track host status in state
  const [isHost, setIsHost] = useState<boolean>(false);

  useEffect(()=>{
    console.log("gameState",gameState);
    
  },[gameState])

  // Update the logging in the component
  useEffect(() => {
    mountCount.current += 1;
    console.log(`Game page mounting (${mountCount.current}):`, {
      gameId,
      userId,
      spotifyToken: !!spotifyToken,
      timestamp: new Date().toISOString()
    });

    return () => {
      console.log(`Game page unmounting (${mountCount.current}):`, {
        gameId,
        timestamp: new Date().toISOString()
      });
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  // Update socket effect to properly handle game state
  useEffect(() => {
    if (!socket || !isConnected || !userId) return;

    console.log('Setting up game socket listeners:', {
        socketId: socket.id,
        userId,
        gameId,
        timestamp: new Date().toISOString()
    });

    // Request initial game state
    socket.emit('requestGameState', { gameId, userId });

    // Handle game state updates
    socket.on('gameState', (newGameState: GameState) => {
        console.log('Received game state:', {
            round: newGameState.currentRound,
            isPlaying: newGameState.isPlaying,
            hostId: newGameState.hostId,
            playerCount: newGameState.players?.length || 0,
            timestamp: new Date().toISOString()
        });

        setGameState(newGameState);
        // Update host status based on userId instead of socketId
        setIsHost(newGameState.hostId === userId);
        if (newGameState.spotifyToken) {
            setSpotifyToken(newGameState.spotifyToken);
        }
        // Important: Set loading to false when we receive the initial game state
        setIsLoading(false);
    });

    // Handle game start - we can simplify this since gameState handles most of it
    socket.on('gameStart', ({ gameState, playlist, spotifyToken }) => {
        console.log('Game start received:', {
            hasGameState: !!gameState,
            hasPlaylist: !!playlist,
            hasToken: !!spotifyToken,
            timestamp: new Date().toISOString()
        });

        if (gameState) {
            setGameState(gameState);
            setIsHost(gameState.hostId === userId);
        }
        if (spotifyToken) {
            setSpotifyToken(spotifyToken);
        }
    });

    // Add error handler to prevent infinite loading
    socket.on('error', (error) => {
        console.error('Socket error in game:', error);
        setErrorMessage(error.message || 'An error occurred');
        setIsLoading(false);
    });

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
        if (isLoading) {
            console.log('Game state loading timeout');
            setIsLoading(false);
            setErrorMessage('Failed to load game state. Please try refreshing.');
        }
    }, 5000);

    return () => {
        console.log('Cleaning up game socket listeners');
        socket.off('gameState');
        socket.off('gameStart');
        socket.off('roundStart');
        socket.off('error');
        clearTimeout(loadingTimeout);
    };
  }, [socket, isConnected, gameId, userId, isLoading]);

  useEffect(() => {
    const token = searchParams.get('spotify_token');
    if (token) {
      console.log('Setting Spotify token from URL');
      setSpotifyToken(token);
    }
  }, [searchParams]);

  const handleGuess = (songName: string) => {
    if (!socket || remainingGuesses <= 0 || !gameState.isPlaying) return;
    
    socket.emit('submitGuess', {
      lobbyId: gameId,
      songName
    });
  };

  const handlePlaybackComplete = () => {
    if (isHost && socket) {
      socket.emit('roundEnd', { lobbyId: gameId });
    }
  };

  const handleExtendDuration = () => {
    if (!socket || !isHost || !gameState.isPlaying) return;
    socket.emit('extendPlayback', { lobbyId: gameId });
  };

  const handleStartRound = async () => {
    if (!socket || !isHost) {
      console.log('Cannot start round:', {
        hasSocket: !!socket,
        isHost,
        userId,
        hostId: gameState.hostId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      console.log('Starting round:', {
        gameId,
        round: gameState.currentRound,
        timestamp: new Date().toISOString()
      });

      socket.emit('startRound', {
        lobbyId: gameId,
        song: availableSongs[Math.floor(Math.random() * availableSongs.length)]
      });

    } catch (error) {
      console.error('Error starting round:', error);
      setErrorMessage('Failed to start round. Please try again.');
    }
  };

  // Update the useEffect that handles game status
  useEffect(() => {
    if (gameState.isPlaying) {
        setGameStatus('Round in progress...');
    } else if (isHost && gameState.currentRound > 0) {
        setGameStatus('Click Start Next Round to begin!');
    } else {
        setGameStatus('Waiting for host to start the round...');
    }
  }, [gameState.isPlaying, gameState.currentRound, isHost]);

  // Add this useEffect for debugging host controls visibility
  useEffect(() => {
    console.log('Host controls visibility check:', {
        isHost,
        currentRound: gameState.currentRound,
        shouldShowControls: isHost && gameState.currentRound > 0,
        timestamp: new Date().toISOString()
    });
  }, [isHost, gameState.currentRound]);

  // Add debug logging for socket connection
  useEffect(() => {
    if (!socket) return;

    console.log('Socket connected in game page:', {
        socketId: socket.id,
        gameId,
        timestamp: new Date().toISOString(),
        gameState: gameState
    });

    return () => {
        console.log('Socket disconnecting from game page:', {
            socketId: socket.id,
            gameId,
            timestamp: new Date().toISOString()
        });
    };
  }, [socket, gameId]);

  // Debug log for host status changes
  useEffect(() => {
    console.log('Host status updated:', {
      isHost,
      userId,
      socketId: socket?.id,
      timestamp: new Date().toISOString()
    });
  }, [isHost, userId, socket?.id]);

  return (
    <main className="min-h-screen p-4 bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Loading game...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {errorMessage && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                {errorMessage}
              </div>
            )}
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Music2 className="h-6 w-6" />
                    Round {gameState.currentRound} of {gameState.totalRounds}
                  </CardTitle>
                  <span className="text-sm font-medium">
                    {gameStatus}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Game Progress */}
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(gameState.currentRound / gameState.totalRounds) * 100}%` 
                    }}
                  />
                </div>

                {/* Host Controls */}
                {isHost && gameState.currentRound > 0 && (
                    <div className="p-4 bg-muted rounded-lg space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Host Controls
                        </h3>
                        <div className="flex gap-4">
                            {!gameState.isPlaying ? (
                                <Button 
                                    className="w-full"
                                    onClick={handleStartRound}
                                    disabled={!availableSongs.length}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Next Round
                                </Button>
                            ) : (
                                <Button 
                                    className="w-full"
                                    variant="secondary"
                                    onClick={() => {
                                        if (socket) {
                                            socket.emit('endRound', { lobbyId: gameId });
                                        }
                                    }}
                                >
                                    <SkipForward className="h-4 w-4 mr-2" />
                                    Skip Round
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Game Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - Game Play */}
                  <div className="space-y-4">
                    {/* Current Song */}
                    {gameState.currentSong && (
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Music className="h-4 w-4" />
                              Current Song
                            </h3>
                            {gameState.isPlaying && (
                              <span className="text-sm text-muted-foreground">
                                {Math.max(0, Math.floor((gameState.currentSong.duration - 
                                  (Date.now() - gameState.currentSong.startTime)) / 1000))}s
                              </span>
                            )}
                          </div>
                          <AudioPlayer
                            previewUrl={gameState.currentSong.previewUrl}
                            duration={gameState.currentSong.duration}
                            onPlaybackComplete={handlePlaybackComplete}
                            isHost={isHost}
                            onExtendDuration={handleExtendDuration}
                            //autoPlay={true}
                          />
                        </div>
                      </div>
                    )}

                    {/* Guessing Section */}
                    {gameState.isPlaying && (
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Make Your Guess</h3>
                            <Badge variant={remainingGuesses > 1 ? "secondary" : "destructive"}>
                              {remainingGuesses} guesses remaining
                            </Badge>
                          </div>
                          <SongSearch
                            spotifyToken={spotifyToken || ''}
                            onGuess={handleGuess}
                            disabled={remainingGuesses <= 0}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Game Info */}
                  <div className="space-y-4">
                    {/* Recent Guesses */}
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Recent Guesses
                      </h3>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {guessResults.map((result, index) => (
                          <div
                            key={index}
                            className={cn(
                              "p-2 rounded-lg",
                              result.correct 
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
                                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100"
                            )}
                          >
                            <span className="font-medium">
                              {result.playerName || 'Player'}:
                            </span>{' '}
                            "{result.guess}"{' '}
                            {result.correct && `(+${result.points} points)`}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scoreboard */}
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Scoreboard
                      </h3>
                      <div className="space-y-2">
                        {gameState.players
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .map((player, index) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-background"
                            >
                              <div className="flex items-center gap-2">
                                {index === 0 && (
                                  <Crown className="h-4 w-4 text-yellow-500" />
                                )}
                                <span>{player.name}</span>
                                {player.isHost && (
                                  <Badge variant="secondary" className="text-xs">
                                    Host
                                  </Badge>
                                )}
                              </div>
                              <span className="font-medium">{player.score || 0} points</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
} 