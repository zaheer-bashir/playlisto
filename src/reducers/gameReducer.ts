import { GameState, GameAction } from '@/types/game';

export const initialGameState: GameState = {
  currentRound: 1,
  totalRounds: 10,
  players: [],
  isPlaying: false
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UPDATE_GAME_STATE':
      return {
        ...state,
        ...action.payload
      };
      
    case 'START_ROUND':
      return {
        ...state,
        isPlaying: true,
        currentSong: {
          previewUrl: action.payload.previewUrl,
          duration: action.payload.duration,
          startTime: action.payload.startTime
        },
        correctSong: undefined
      };
      
    case 'END_ROUND':
      return {
        ...state,
        isPlaying: false,
        currentSong: undefined,
        correctSong: action.payload.correctSong,
        currentRound: state.currentRound + 1
      };
      
    case 'UPDATE_PLAYERS':
      return {
        ...state,
        players: action.payload
      };
      
    case 'RESET_GAME':
      return initialGameState;
      
    default:
      return state;
  }
} 