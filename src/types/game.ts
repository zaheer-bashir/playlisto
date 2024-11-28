export interface Player {
  id: string;
  userId: string;
  name: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
}

export interface Lobby {
  id: string;
  players: Player[];
  hostUserId?: string;
  spotifyPlaylist?: {
    id: string;
    name: string;
  };
  spotifyToken?: string;
  gameState?: GameState;
}

export interface GameState {
  currentRound: number;
  totalRounds: number;
  players: Player[];
  currentSong?: {
    previewUrl: string;
    duration: number;
    startTime: number;
  };
  isPlaying: boolean;
  correctSong?: {
    id: string;
    name: string;
    artists: string[];
  };
}

export type GameAction = 
  | { type: 'UPDATE_GAME_STATE'; payload: GameState }
  | { type: 'START_ROUND'; payload: { previewUrl: string; duration: number; startTime: number } }
  | { type: 'END_ROUND'; payload: { correctSong?: GameState['correctSong'] } }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'RESET_GAME' }; 