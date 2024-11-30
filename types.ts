interface Player {
  id: string;
  userId: string;
  name: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasGuessedCorrectly: boolean;
  currentRoundData: {
    remainingGuesses: number;
    guessHistory: Array<{
      guess: string;
      timestamp: number;
      wasCorrect: boolean;
      snippetDuration: number;
    }>;
    lastSnippetDuration: number;
  };
  gameHistory: {
    correctGuesses: number;
    totalGuesses: number;
    averageGuessTime: number;
    bestScore: number;
  };
}

interface Lobby {
  id: string;
  players: Player[];
  hostId: string;
  gameState?: GameState;
  lastActivity: number;
  spotifyToken?: string;
}

interface GameState {
  currentRound: number;
  totalRounds: number;
  isPlaying: boolean;
  currentSong?: {
    id: string;
    name: string;
    duration: number;
    startTime: number;
  };
  roundHistory: Array<{
    songId: string;
    winners: string[];
    duration: number;
  }>;
  players: Player[];
  playlist: any;
}

// ... other type definitions 