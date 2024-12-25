import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useUserId } from "@/hooks/useUserId";

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
  playlist?: any;
}

interface GuessResult {
  playerId: string;
  playerName?: string;
  correct: boolean;
  points?: number;
  guess: string;
  timeElapsed?: number;
}

export function useGame() {
  const params = useParams();
  const gameId = params.id as string;
  const userId = useUserId();
  const { socket, isConnected } = useSocket(
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
  );
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1,
    totalRounds: 10,
    players: [],
    isPlaying: false,
    snippetDuration: 500,
  });
  const [remainingGuesses, setRemainingGuesses] = useState(3);
  const [guessResults, setGuessResults] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<string>(
    "Waiting for host to start the round..."
  );
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [availableSongs, setAvailableSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountCount = useRef(0);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [snippetDuration, setSnippetDuration] = useState(500);
  const [currentGuessResult, setCurrentGuessResult] = useState<{
    correct: boolean;
    points?: number;
    message: string;
  } | null>(null);
  const [gameOver, setGameOver] = useState<{
    rankings: Array<{
      rank: number;
      name: string;
      score: number;
      isHost: boolean;
      userId: string;
    }>;
    totalRounds: number;
    playlistName?: string;
  } | null>(null);

  useEffect(() => {
    if (!gameState.isPlaying) {
      setSnippetDuration(500);
      setRemainingGuesses(3);
    }
  }, [gameState.isPlaying]);

  useEffect(() => {
    mountCount.current += 1;

    return () => {};
  }, [gameId, spotifyToken, userId]);

  useEffect(() => {
    const storedState = sessionStorage.getItem("initialGameState");
    if (storedState) {
      const parsedState = JSON.parse(storedState);

      setGameState(parsedState);
      setSpotifyToken(parsedState.spotifyToken);
      setIsHost(parsedState.hostId === userId);

      if (parsedState.playlist?.tracks?.items) {
        const songs = parsedState.playlist.tracks.items
          .filter((item: any) => item.track)
          .map((item: any) => item.track);
        setAvailableSongs(songs);
      }

      setIsLoading(false);

      sessionStorage.removeItem("initialGameState");
    }
  }, [userId]);

  useEffect(() => {
    if (!socket || !isConnected || !userId) return;

    socket.on("gameState", (newGameState: GameState) => {
      setIsHost(newGameState.hostId === userId);

      setGameState(newGameState);

      if (newGameState.spotifyToken) {
        setSpotifyToken(newGameState.spotifyToken);
      }

      if (newGameState.playlist?.tracks?.items) {
        const songs = newGameState.playlist.tracks.items
          .filter((item: any) => item.track)
          .map((item: any) => item.track);

        setAvailableSongs(songs);
      }

      setIsLoading(false);
    });

    if (!sessionStorage.getItem("initialGameState")) {
      socket.emit("requestGameState", { gameId, userId });
    }

    socket.on("error", (error: string) => {
      setErrorMessage(error);
      setIsLoading(false);
    });

    return () => {
      socket.off("gameState");
      socket.off("error");
    };
  }, [socket, isConnected, userId, gameId]);

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
      socket?.emit("requestGameState", { gameId, userId });
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoading, socket, gameId, userId]);

  const handleGuess = (songName: string) => {
    if (!socket || remainingGuesses <= 0 || !gameState.isPlaying) return;

    const currentPlayer = gameState.players.find((p) => p.userId === userId);
    if (currentPlayer?.hasGuessedCorrectly) return;

    socket.emit("submitGuess", { lobbyId: gameId, songName, snippetDuration });

    setRemainingGuesses((prev) => prev - 1);
  };

  const handleExtendDuration = (additionalTime: number) => {
    if (!socket || !isHost) return;

    const newDuration = (gameState.snippetDuration || 500) + additionalTime;

    socket.emit("extendDuration", {
      lobbyId: gameId,
      newDuration,
    });
  };

  const handleSkipRound = () => {
    if (socket) {
      socket.emit("endRound", { lobbyId: gameId });
    }
  };

  const handleStartRound = async () => {
    if (!socket || !isHost) return;

    try {
      socket.emit("startRound", { lobbyId: gameId });
    } catch (error) {
      console.error("Error starting round:", error);
      setErrorMessage("Failed to start round. Please try again.");
    }
  };

  useEffect(() => {
    if (gameState.isPlaying) {
      setGameStatus("Round in progress...");
    } else if (isHost && gameState.currentRound > 0) {
      setGameStatus("Click Start Next Round to begin!");
    } else {
      setGameStatus("Waiting for host to start the round...");
    }
  }, [gameState.isPlaying, gameState.currentRound, isHost]);

  useEffect(() => {
    if (!socket) return;

    return () => {};
  }, [socket, gameId, gameState]);

  useEffect(() => {
    if (!socket) return;

    socket.on("roundStart", ({ duration, serverTime }) => {
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

    socket.on("roundEnd", ({ nextRound }) => {
      setRemainingGuesses(3);
      setCurrentGuessResult(null);

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

  useEffect(() => {
    if (gameState.isPlaying) {
      setGameStatus("Round in progress...");
    } else if (isHost && gameState.currentRound > 0) {
      setGameStatus("Click Start Next Round to begin!");
    } else {
      setGameStatus("Waiting for host to start the round...");
    }
  }, [gameState.isPlaying, gameState.currentRound, isHost]);

  useEffect(() => {
    if (!socket) return;

    socket.on("gameStart", (data: any) => {
      setGameState(data.gameState);
      setSpotifyToken(data.spotifyToken);
      setIsHost(data.gameState.hostId === userId);

      if (data.playlist?.tracks?.items) {
        const songs = data.playlist.tracks.items
          .filter((item: any) => item.track)
          .map((item: any) => item.track);

        setAvailableSongs(songs);
      }

      setIsLoading(false);
    });

    return () => {
      socket.off("gameStart");
    };
  }, [socket, userId]);

  useEffect(() => {
    if (!isHost || !socket || !gameState.isPlaying || !availableSongs.length) {
      return;
    }
    if (!gameState.currentSong) {
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

  useEffect(() => {
    if (!socket) return;

    const handleGuessResult = (result: any) => {
      setGuessResults((prev) => {
        console.log("🔍 Updating Guess Results:", {
          previousResults: prev,
          newResult: result,
          timestamp: new Date().toISOString(),
        });
        const newResults = [result, ...prev].slice(0, 10);
        return newResults;
      });

      if (result.correct) {
        setGameState((prev) => {
          const updatedState = {
            ...prev,
            players: prev.players.map((p) =>
              p.id === result.playerId
                ? {
                    ...p,
                    score: (p.score || 0) + (result.points || 0),
                    hasGuessedCorrectly: true,
                  }
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

  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdate = (newGameState: GameState) => {
      setGameState(newGameState);

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

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("requestGameState", { gameId, userId });
  }, [isConnected, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("gameState", (newState) => {
      setGameState(newState);
      setSnippetDuration(newState.snippetDuration || 500);
    });

    socket.on("roundEnd", ({ nextRound }) => {
      setRemainingGuesses(3);
      setCurrentGuessResult(null);
      setSnippetDuration(500);

      setGameState((prev) => ({
        ...prev,
        isPlaying: false,
        currentSong: undefined,
        currentRound: nextRound,
        snippetDuration: 500,
      }));
    });

    return () => {
      socket.off("gameState");
      socket.off("roundEnd");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("gameOver", (gameOverState) => {
      setGameOver(gameOverState);
    });

    return () => {
      socket.off("gameOver");
    };
  }, [socket]);

  const handleReturnToLobby = () => {
    if (!socket) return;

    const playerName = gameState.players.find((p) => p.userId === userId)?.name;
    const isHost = gameState.hostId === userId;

    socket.emit("returnToLobby", { lobbyId: gameId });

    router.push(
      `/lobby/${gameId}?name=${encodeURIComponent(
        playerName || ""
      )}&host=${isHost}`
    );
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("returnToLobby", (data) => {
      const playerName = data.players.find(
        (p: Player) => p.userId === userId
      )?.name;
      const isHost = data.players.find(
        (p: Player) => p.userId === userId
      )?.isHost;

      sessionStorage.removeItem("initialGameState");

      router.push(
        `/lobby/${gameId}?name=${encodeURIComponent(
          playerName || ""
        )}&host=${isHost}`
      );
    });

    return () => {
      socket.off("returnToLobby");
    };
  }, [socket, gameId, userId, router]);

  return {
    gameState,
    remainingGuesses,
    guessResults,
    gameStatus,
    spotifyToken,
    availableSongs,
    isLoading,
    isHost,
    snippetDuration,
    currentGuessResult,
    gameOver,
    userId,
    isConnected,
    handleGuess,
    handleStartRound,
    handleExtendDuration,
    handleSkipRound,
    handleReturnToLobby,
  };
}
