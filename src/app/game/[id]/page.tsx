"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioPlayer } from "@/components/audio-player";
import { SongSearch } from "@/components/song-search";
import { Loader2 } from "lucide-react";
import {
  Music2,
  Crown,
  Play,
  SkipForward,
  MessageSquare,
  Trophy,
  Music,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUserId } from "@/hooks/useUserId";
import { RoundTimer } from "@/components/round-timer";

interface Player {
  id: string;
  userId?: string;
  name: string;
  score: number;
  isHost: boolean;
  hasGuessedCorrectly?: boolean;
}

interface GameState {
  currentRound: number;
  totalRounds: number;
  players: Player[];
  currentSong?: {
    id: string;
    name: string;
    duration: number;
    startTime: number;
    previewUrl?: string;
  };
  snippetDuration: number;
  isPlaying: boolean;
  hostId?: string;
  spotifyToken?: string;
  playlist?: Playlist;
}

interface GuessResult {
  playerId: string;
  playerName?: string;
  correct: boolean;
  points?: number;
  guess: string;
  timeElapsed?: number;
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
      };
    }>;
  };
}

interface GameStartData {
  playlist: Playlist;
  gameState: GameState;
  spotifyToken: string;
}

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const userId = useUserId();
  const { socket, isConnected } = useSocket(
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
  );

  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1,
    totalRounds: 10,
    players: [],
    isPlaying: false,
    snippetDuration: 500
  });
  const [guess, setGuess] = useState("");
  const [remainingGuesses, setRemainingGuesses] = useState(3);
  const [guessResults, setGuessResults] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<string>(
    "Waiting for host to start the round..."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<any>(null);
  const [availableSongs, setAvailableSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add a mount counter ref to track mounts
  const mountCount = useRef(0);

  // Track host status in state
  const [isHost, setIsHost] = useState<boolean>(false);

  // Add state for snippet duration
  const [snippetDuration, setSnippetDuration] = useState(500); // Default 500ms

  // Reset snippet duration when round changes
  useEffect(() => {
    if (!gameState.isPlaying) {
      setSnippetDuration(500); // Reset to default duration
      setRemainingGuesses(3); // Reset guesses
      console.log("🟢 Reset round state:", {
        snippetDuration: 500,
        remainingGuesses: 3,
        timestamp: new Date().toISOString(),
      });
    }
  }, [gameState.isPlaying]);

  // Add new state for the current player's guess result
  const [currentGuessResult, setCurrentGuessResult] = useState<{
    correct: boolean;
    points?: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    console.log("gameState", gameState);
  }, [gameState]);

  // Update the logging in the component
  useEffect(() => {
    mountCount.current += 1;
    console.log(`Game page mounting (${mountCount.current}):`, {
      gameId,
      userId,
      spotifyToken: !!spotifyToken,
      timestamp: new Date().toISOString(),
    });

    return () => {
      console.log(`Game page unmounting (${mountCount.current}):`, {
        gameId,
        timestamp: new Date().toISOString(),
      });
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  // Add effect to handle initial state
  useEffect(() => {
    // Try to get initial state from sessionStorage
    const storedState = sessionStorage.getItem("initialGameState");
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      console.log("🟢 Loading initial game state:", {
        hasPlaylist: !!parsedState.playlist,
        hasSong: !!parsedState.currentSong,
        timestamp: new Date().toISOString(),
      });

      setGameState(parsedState);
      setSpotifyToken(parsedState.spotifyToken);
      setIsHost(parsedState.hostId === userId);

      if (parsedState.playlist?.tracks?.items) {
        const songs = parsedState.playlist.tracks.items
          .filter((item: PlaylistItem) => item.track)
          .map((item: PlaylistItem) => item.track);
        setAvailableSongs(songs);
      }

      setIsLoading(false);

      // Clear stored state after loading
      sessionStorage.removeItem("initialGameState");
    }
  }, [userId]);

  // Update socket effect to properly handle game state
  useEffect(() => {
    if (!socket || !isConnected || !userId) {
      console.log("🔴 Missing dependencies for game setup:", {
        hasSocket: !!socket,
        isConnected,
        hasUserId: !!userId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log("🟢 Setting up game socket listeners:", {
      socketId: socket.id,
      userId,
      gameId,
      timestamp: new Date().toISOString(),
    });

    socket.on("gameState", (newGameState: GameState) => {
      console.log("🟢 Received game state:", {
        round: newGameState.currentRound,
        isPlaying: newGameState.isPlaying,
        hostId: newGameState.hostId,
        hasPlaylist: !!newGameState.playlist,
        hasSong: !!newGameState.currentSong,
        songId: newGameState.currentSong?.id,
        songName: newGameState.currentSong?.name,
        playerCount: newGameState.players?.length || 0,
        timestamp: new Date().toISOString(),
      });

      // Update host status
      setIsHost(newGameState.hostId === userId);

      // Update game state
      setGameState(newGameState);

      // Update Spotify token if available
      if (newGameState.spotifyToken) {
        setSpotifyToken(newGameState.spotifyToken);
      }

      // Update available songs if playlist exists
      if (newGameState.playlist?.tracks?.items) {
        const songs = newGameState.playlist.tracks.items
          .filter((item) => item.track)
          .map((item) => item.track);

        console.log("🟢 Setting up available songs:", {
          total: songs.length,
          firstSong: songs[0]?.name || "No songs",
          hasPreviewUrls: songs.some((song) => song.preview_url),
          timestamp: new Date().toISOString(),
        });

        setAvailableSongs(songs);
      }

      // Clear loading state
      setIsLoading(false);
    });

    // Request game state only if we don't have initial state
    if (!sessionStorage.getItem("initialGameState")) {
      console.log("🟡 Requesting game state:", {
        gameId,
        userId,
        timestamp: new Date().toISOString(),
      });
      socket.emit("requestGameState", { gameId, userId });
    }

    // Add error handler
    socket.on("error", (error: string) => {
      console.error("�� Socket error in game:", {
        error,
        socketId: socket.id,
        gameId,
        userId,
        timestamp: new Date().toISOString(),
      });
      setErrorMessage(error);
      setIsLoading(false);
    });

    return () => {
      socket.off("gameState");
      socket.off("error");
    };
  }, [socket, isConnected, userId, gameId]);

  // Add effect to handle loading timeout
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      if (socket?.connected) {
        console.log("⚠️ Still loading game state:", {
          socketId: socket.id,
          gameId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    }, 1000);

    const timeout = setTimeout(() => {
      console.log("🔴 Game state loading timeout - requesting again:", {
        socketId: socket?.id,
        gameId,
        userId,
        timestamp: new Date().toISOString(),
      });
      socket?.emit("requestGameState", { gameId, userId });
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoading, socket, gameId, userId]);

  // Add debug logging for game state changes
  useEffect(() => {
    console.log("🟢 Game state updated:", {
      currentRound: gameState.currentRound,
      isPlaying: gameState.isPlaying,
      playerCount: gameState.players.length,
      timestamp: new Date().toISOString(),
    });
  }, [gameState]);

  // Add debug logging for loading state changes
  useEffect(() => {
    console.log("🟡 Loading state changed:", {
      isLoading,
      timestamp: new Date().toISOString(),
    });
  }, [isLoading]);

  const handleGuess = (songName: string) => {
    if (!socket || remainingGuesses <= 0 || !gameState.isPlaying) {
      console.log("🔴 Cannot submit guess:", {
        hasSocket: !!socket,
        remainingGuesses,
        isPlaying: gameState.isPlaying,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check if player has already guessed correctly
    const currentPlayer = gameState.players.find(p => p.userId === userId);
    if (currentPlayer?.hasGuessedCorrectly) {
      console.log("🔴 Player has already guessed correctly");
      return;
    }

    console.log("🟢 Submitting guess to server:", {
      lobbyId: gameId,
      songName,
      snippetDuration,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.emit("submitGuess", { lobbyId: gameId, songName, snippetDuration });

    // Decrease remaining guesses
    setRemainingGuesses((prev) => {
      console.log("🟡 Updating remaining guesses:", {
        previous: prev,
        new: prev - 1,
        timestamp: new Date().toISOString(),
      });
      return prev - 1;
    });
  };

  const handlePlaybackComplete = () => {
    if (isHost && socket) {
      socket.emit("roundEnd", { lobbyId: gameId });
    }
  };

  const handleExtendDuration = (additionalTime: number) => {
    if (!socket || !isHost) return;

    const newDuration = (gameState.snippetDuration || 500) + additionalTime;
    console.log("🟡 Extending duration:", {
      currentDuration: gameState.snippetDuration,
      additionalTime,
      newDuration,
      timestamp: new Date().toISOString(),
    });

    socket.emit("extendDuration", { 
      lobbyId: gameId, 
      newDuration 
    });
  };

  const handleSkipRound = () => {
    if (socket) {
      socket.emit("endRound", { lobbyId: gameId });
    }
  };

  const handleStartRound = async () => {
    if (!socket || !isHost) {
      console.log("Cannot start round:", {
        hasSocket: !!socket,
        isHost,
        userId,
        hostId: gameState.hostId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      console.log("Starting round:", {
        gameId,
        round: gameState.currentRound,
        timestamp: new Date().toISOString(),
      });

      socket.emit("startRound", { lobbyId: gameId });
    } catch (error) {
      console.error("Error starting round:", error);
      setErrorMessage("Failed to start round. Please try again.");
    }
  };

  // Update the useEffect that handles game status
  useEffect(() => {
    if (gameState.isPlaying) {
      setGameStatus("Round in progress...");
    } else if (isHost && gameState.currentRound > 0) {
      setGameStatus("Click Start Next Round to begin!");
    } else {
      setGameStatus("Waiting for host to start the round...");
    }
  }, [gameState.isPlaying, gameState.currentRound, isHost]);

  // Add this useEffect for debugging host controls visibility
  useEffect(() => {
    console.log("Host controls visibility check:", {
      isHost,
      currentRound: gameState.currentRound,
      shouldShowControls: isHost && gameState.currentRound > 0,
      timestamp: new Date().toISOString(),
    });
  }, [isHost, gameState.currentRound]);

  // Add debug logging for socket connection
  useEffect(() => {
    if (!socket) return;

    console.log("Socket connected in game page:", {
      socketId: socket.id,
      gameId,
      timestamp: new Date().toISOString(),
      gameState: gameState,
    });

    return () => {
      console.log("Socket disconnecting from game page:", {
        socketId: socket.id,
        gameId,
        timestamp: new Date().toISOString(),
      });
    };
  }, [socket, gameId]);

  // Debug log for host status changes
  useEffect(() => {
    console.log("Host status updated:", {
      isHost,
      userId,
      socketId: socket?.id,
      timestamp: new Date().toISOString(),
    });
  }, [isHost, userId, socket?.id]);

  // Add effect to track available songs
  useEffect(() => {
    console.log("Available songs updated:", {
      count: availableSongs.length,
      hasPreviews: availableSongs.every((song) => song.preview_url),
      timestamp: new Date().toISOString(),
    });
  }, [availableSongs]);

  // Add round start and end handlers
  useEffect(() => {
    if (!socket) return;

    // Handle round start
    socket.on("roundStart", ({ previewUrl, duration, serverTime }) => {
      console.log("🟢 Round start received:", {
        hasPreviewUrl: !!previewUrl,
        duration,
        serverTime,
        timestamp: new Date().toISOString(),
      });

      setGameState((prev) => ({
        ...prev,
        isPlaying: true,
        currentSong: {
          id: `temp-${Date.now()}`,
          name: `temp-${Date.now()}`,
          duration,
          startTime: serverTime,
        },
      }));
      setRemainingGuesses(3);
      setGuessResults([]);
    });

    // Handle round end
    socket.on("roundEnd", ({ correctSong, nextRound }) => {
      // Reset remaining guesses for next round
      setRemainingGuesses(3);

      // Clear current guess result if any
      setCurrentGuessResult(null);

      console.log("🟢 Round ended:", {
        correctSong,
        nextRound,
        timestamp: new Date().toISOString(),
      });

      setGameState((prev) => ({
        ...prev,
        isPlaying: false,
        currentSong: undefined,
        currentRound: nextRound,
      }));
    });

    return () => {
      socket.off("roundStart");
      socket.off("roundEnd");
    };
  }, [socket]);

  // Update the game status effect to reflect isPlaying state
  useEffect(() => {
    console.log("🟡 Game status update:", {
      isPlaying: gameState.isPlaying,
      currentRound: gameState.currentRound,
      isHost,
      timestamp: new Date().toISOString(),
    });

    if (gameState.isPlaying) {
      setGameStatus("Round in progress...");
    } else if (isHost && gameState.currentRound > 0) {
      setGameStatus("Click Start Next Round to begin!");
    } else {
      setGameStatus("Waiting for host to start the round...");
    }
  }, [gameState.isPlaying, gameState.currentRound, isHost]);

  // Add effect to handle game start
  useEffect(() => {
    if (!socket) return;

    socket.on("gameStart", (data: GameStartData) => {
      console.log("🟢 Received game start data:", {
        hasGameState: !!data.gameState,
        hasPlaylist: !!data.playlist,
        hasSong: !!data.gameState?.currentSong,
        timestamp: new Date().toISOString(),
      });

      // Set initial game state
      setGameState(data.gameState);
      setSpotifyToken(data.spotifyToken);
      setIsHost(data.gameState.hostId === userId);

      if (data.playlist?.tracks?.items) {
        const songs = data.playlist.tracks.items
          .filter((item) => item.track)
          .map((item) => item.track);

        console.log("🟢 Setting up initial songs:", {
          total: songs.length,
          firstSong: songs[0]?.name,
          hasPreviewUrls: songs.some((song) => song.preview_url),
          timestamp: new Date().toISOString(),
        });

        setAvailableSongs(songs);
      }

      setIsLoading(false);
    });

    return () => {
      socket.off("gameStart");
    };
  }, [socket, userId]);

  // Add this effect to auto-start first round
  useEffect(() => {
    if (!isHost || !socket || !gameState.isPlaying || !availableSongs.length) {
      return;
    }

    console.log("🟡 Checking auto-start conditions:", {
      isHost,
      isPlaying: gameState.isPlaying,
      availableSongs: availableSongs.length,
      hasSong: !!gameState.currentSong,
      timestamp: new Date().toISOString(),
    });

    if (!gameState.currentSong) {
      console.log("🟡 Auto-starting first round");
      socket.emit("startRound", { lobbyId: gameId });
    }
  }, [
    isHost,
    socket,
    gameState.isPlaying,
    gameState.currentSong,
    availableSongs,
    gameId,
  ]);

  // Add this debug effect to track currentGuessResult changes
  useEffect(() => {
    console.log("🟡 Current guess result changed:", {
      hasResult: !!currentGuessResult,
      result: currentGuessResult,
      timestamp: new Date().toISOString(),
    });
  }, [currentGuessResult]);

  // Update the effect that handles guess results
  useEffect(() => {
    if (!socket) {
      console.log("🔴 No socket available for guess results");
      return;
    }

    console.log("🔍 Setting up guessResult listener:", {
      socketId: socket.id,
      userId,
      isConnected: socket.connected,
      hasGameState: !!gameState,
      timestamp: new Date().toISOString(),
    });

    const handleGuessResult = (result: any) => {
      console.log("🟡 GuessResult Handler Details:", {
        result,
        currentUserId: userId,
        resultPlayerId: result.playerId,
        isCurrentPlayer: result.playerId === userId,
        socketId: socket.id,
        hasGameState: !!gameState,
        currentPlayers: gameState?.players?.map(p => ({ id: p.id, name: p.name })),
        timestamp: new Date().toISOString(),
      });

      // Update guess results for ALL players
      setGuessResults((prev) => {
        console.log("🔍 Updating Guess Results:", {
          previousResults: prev,
          newResult: result,
          timestamp: new Date().toISOString(),
        });
        const newResults = [result, ...prev].slice(0, 10);
        return newResults;
      });

      // Update game state for ALL players if the guess was correct
      if (result.correct) {
        console.log("🔍 Updating Game State for Correct Guess:", {
          resultPlayerId: result.playerId,
          currentGameState: gameState,
          timestamp: new Date().toISOString(),
        });
        
        setGameState((prev) => {
          const updatedState = {
            ...prev,
            players: prev.players.map((p) =>
              p.id === result.playerId
                ? { ...p, score: (p.score || 0) + (result.points || 0), hasGuessedCorrectly: true }
                : p
            ),
          };
          return updatedState;
        });
      }
    };

    socket.on("guessResult", handleGuessResult);

    return () => {
      socket.off("guessResult", handleGuessResult);
    };
  }, [socket, userId, gameState]);

  // Add a separate effect to handle game state updates
  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdate = (newGameState: GameState) => {
      console.log("🟢 Received game state update:", {
        currentRound: newGameState.currentRound,
        isPlaying: newGameState.isPlaying,
        playerCount: newGameState.players?.length,
        players: newGameState.players?.map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          hasGuessedCorrectly: p.hasGuessedCorrectly,
        })),
        timestamp: new Date().toISOString(),
      });

      // Always update the game state when received from server
      setGameState(newGameState);

      // Update remaining guesses if round is not playing
      if (!newGameState.isPlaying) {
        setRemainingGuesses(3);
        setCurrentGuessResult(null);
      }
    };

    socket.on("gameState", handleGameStateUpdate);

    return () => {
      socket.off("gameState", handleGameStateUpdate);
    };
  }, [socket]);

  // Add a reconnection effect
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("🟢 Socket reconnected, requesting game state:", {
      socketId: socket.id,
      gameId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Re-join the game room
    socket.emit("requestGameState", { gameId, userId });
  }, [isConnected, socket]);

  // Add snippetDuration to the state updates when receiving game state
  useEffect(() => {
    if (!socket) return;

    socket.on("gameState", (newState) => {
      setGameState(newState);
      // Update local snippet duration when game state changes
      setSnippetDuration(newState.snippetDuration || 500);
    });

    // Update round end handler to reset duration
    socket.on("roundEnd", ({ correctSong, nextRound }) => {
      setRemainingGuesses(3);
      setCurrentGuessResult(null);
      setSnippetDuration(500); // Reset to default duration

      console.log("🟢 Round ended:", {
        correctSong,
        nextRound,
        timestamp: new Date().toISOString(),
      });

      setGameState((prev) => ({
        ...prev,
        isPlaying: false,
        currentSong: undefined,
        currentRound: nextRound,
        snippetDuration: 500, // Ensure game state also resets duration
      }));
    });

    return () => {
      socket.off("gameState");
      socket.off("roundEnd");
    };
  }, [socket]);

  return (
    <main className="min-h-screen bg-[#1E1F2A] bg-[url('/notes-pattern.png')] bg-repeat bg-opacity-5">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {isLoading ? (
          <Card className="shadow-2xl border-none">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-lg">Loading game...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-2xl border-none">
              <CardHeader className="border-b border-border/10">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <Music2 className="h-7 w-7 text-primary" />
                    Round {gameState.currentRound} of {gameState.totalRounds}
                  </CardTitle>
                  <span className="text-sm font-medium px-4 py-1.5 rounded-full bg-secondary/50">
                    {gameStatus}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Game Progress */}
                <div className="w-full bg-secondary/50 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        (gameState.currentRound / gameState.totalRounds) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Host Controls */}
                {isHost && gameState.currentRound > 0 && (
                  <div className="p-6 bg-secondary/30 rounded-xl space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-lg">
                      <Crown className="h-5 w-5 text-primary" />
                      Host Controls
                    </h3>
                    <div className="flex flex-col gap-4">
                      {/* Audio Controls for Host */}
                      {gameState.currentSong && gameState.isPlaying && (
                        <div className="flex items-center gap-2">
                          <AudioPlayer
                            songId={gameState.currentSong.id}
                            duration={snippetDuration}
                            onPlaybackComplete={() => {}}
                            isHost={isHost}
                            onExtendDuration={handleExtendDuration}
                            onSkipRound={handleSkipRound}
                            spotifyToken={spotifyToken || ""}
                            showControls={true}
                          />
                        </div>
                      )}

                      {/* Start Round button (only show when round is not active) */}
                      {!gameState.isPlaying && (
                        <Button
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleStartRound}
                          disabled={!availableSongs.length}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Next Round
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Game Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Game Play */}
                  <div className="space-y-6">
                    {/* */}

                    {/* Guessing Section */}
                    {gameState.isPlaying && (
                      <div className="p-6 bg-secondary/30 rounded-xl">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Make Your Guess</h3>
                            <div className="flex items-center gap-2">
                              {gameState.currentSong && (
                                <RoundTimer 
                                  startTime={gameState.currentSong.startTime} 
                                  isPlaying={gameState.isPlaying} 
                                />
                              )}
                              <Badge
                                variant={remainingGuesses > 1 ? "secondary" : "destructive"}
                              >
                                {remainingGuesses} guesses remaining
                              </Badge>
                            </div>
                          </div>

                          {/* Guess Result Feedback */}
                          {currentGuessResult && (
                            <div
                              className={cn(
                                "p-3 rounded-md text-sm font-medium mb-3 animate-in fade-in slide-in-from-top-1",
                                currentGuessResult.correct
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-100"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-100"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span>{currentGuessResult.message}</span>
                                {currentGuessResult.points && (
                                  <span className="font-bold">
                                    +{currentGuessResult.points} points
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <SongSearch
                            spotifyToken={spotifyToken || ""}
                            onGuess={handleGuess}
                            disabled={remainingGuesses <= 0}
                            hasGuessedCorrectly={gameState.players.find(p => p.userId === userId)?.hasGuessedCorrectly}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Game Info */}
                  <div className="space-y-6">
                    {/* Recent Guesses */}
                    <div className="p-6 bg-secondary/30 rounded-xl">
                      <h3 className="font-semibold flex items-center gap-2 text-lg mb-4">
                        <MessageSquare className="h-5 w-5 text-primary" />
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
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">
                                  {result.playerName || "Player"}:
                                </span>{" "}
                                "{result.guess}"
                              </div>
                              <div className="text-sm">
                                {result.correct && (
                                  <>
                                    {result.timeElapsed && `${(result.timeElapsed / 1000).toFixed(1)}s `}
                                    {`(+${result.points} points)`}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scoreboard */}
                    <div className="p-6 bg-secondary/30 rounded-xl">
                      <h3 className="font-semibold flex items-center gap-2 text-lg mb-4">
                        <Trophy className="h-5 w-5 text-primary" />
                        Scoreboard
                      </h3>
                      <div className="space-y-3">
                        {gameState.players
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .map((player, index) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {index === 0 && (
                                  <Crown className="h-4 w-4 text-primary" />
                                )}
                                <span>{player.name}</span>
                                {player.isHost && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Host
                                  </Badge>
                                )}
                              </div>
                              <span className="font-medium">
                                {player.score || 0} points
                              </span>
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
