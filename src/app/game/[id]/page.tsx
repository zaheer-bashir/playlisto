"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioPlayer } from '@/components/audio-player';
import { SongSearch } from '@/components/song-search';

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
}

interface GuessResult {
  playerId: string;
  playerName?: string;
  correct: boolean;
  points?: number;
  guess: string;
}

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const playlistId = searchParams.get('playlist');
  
  const [gameState, setGameState] = useState<GameState>({
    currentRound: 0,
    totalRounds: 10,
    players: []
  });
  const [guess, setGuess] = useState('');
  const [remainingGuesses, setRemainingGuesses] = useState(3);
  const socket = useSocket(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
  const [guessResults, setGuessResults] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for game state updates
    socket.on('gameStateUpdate', (newState: GameState) => {
      console.log('Game state update:', newState);
      setGameState(newState);
      // Update isHost status
      const currentPlayer = newState.players.find(p => p.id === socket.id);
      setIsHost(currentPlayer?.isHost || false);
    });

    // Listen for new round
    socket.on('newRound', (roundData) => {
      console.log('New round started:', roundData);
      setGuess('');
      setRemainingGuesses(3);
      setGuessResults([]);
      setGameStatus(`Round ${roundData.round} started!`);
    });

    // Listen for guess results
    socket.on('guessResult', (result: GuessResult) => {
      console.log('Guess result:', result);
      setGuessResults(prev => [...prev, result]);
      
      if (result.correct) {
        setGameStatus(`${result.playerName} guessed correctly! (+${result.points} points)`);
      } else if (socket.id === result.playerId) {
        setRemainingGuesses(prev => prev - 1);
        setGameStatus(`Wrong guess: "${result.guess}"`);
      }
    });

    // Listen for round end
    socket.on('roundEnd', ({ correctSong, scores }) => {
      console.log('Round ended:', { correctSong, scores });
      setGameStatus(`Round ended! The song was: ${correctSong}`);
    });

    // Listen for game end
    socket.on('gameEnd', ({ finalScores }) => {
      console.log('Game ended:', finalScores);
      setGameStatus('Game Over!');
    });

    // Listen for errors
    socket.on('error', (message) => {
      console.error('Game error:', message);
      setErrorMessage(message);
    });

    // Add songExtended listener
    socket.on('songExtended', (songData) => {
      console.log('Song duration extended:', songData);
      setGameState(prev => ({
        ...prev,
        currentSong: songData
      }));
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('newRound');
      socket.off('guessResult');
      socket.off('roundEnd');
      socket.off('gameEnd');
      socket.off('error');
      socket.off('songExtended');
    };
  }, [socket]);

  useEffect(() => {
    // Get spotify token from URL or localStorage
    const token = searchParams.get('spotify_token');
    if (token) {
      setSpotifyToken(token);
    }
  }, [searchParams]);

  const handleGuess = (guess: string) => {
    if (!socket || remainingGuesses <= 0) return;
    
    socket.emit('submitGuess', {
      gameId,
      guess: guess.trim()
    });
  };

  const handlePlaybackComplete = () => {
    console.log('Playback completed');
    // You can add additional logic here if needed
  };

  const handleExtendDuration = () => {
    if (!socket || !isHost) return;
    socket.emit('extendSong', { gameId });
  };

  return (
    <main className="min-h-screen p-4 bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto space-y-4">
        {errorMessage && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Round {gameState.currentRound} of {gameState.totalRounds}
              </CardTitle>
              <span className="text-sm font-medium">
                {gameStatus}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Song Player Section */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <h3 className="font-semibold">Current Song</h3>
                {gameState.currentSong?.previewUrl && (
                  <AudioPlayer
                    previewUrl={gameState.currentSong.previewUrl}
                    duration={gameState.currentSong.duration}
                    onPlaybackComplete={handlePlaybackComplete}
                    isHost={isHost}
                    onExtendDuration={handleExtendDuration}
                  />
                )}
              </div>
            </div>

            {/* Guessing Section */}
            <div className="space-y-2">
              <SongSearch
                spotifyToken={spotifyToken || ''}
                onGuess={handleGuess}
                disabled={remainingGuesses <= 0}
              />
              <p className="text-sm text-muted-foreground">
                Remaining guesses: {remainingGuesses}
              </p>
            </div>

            {/* Scoreboard */}
            <div className="space-y-2">
              <h3 className="font-semibold">Scoreboard</h3>
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <span>{player.name}</span>
                      {player.isHost && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Host
                        </span>
                      )}
                    </div>
                    <span>{player.score} points</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guess Results */}
            <div className="space-y-2">
              <h3 className="font-semibold">Recent Guesses</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {guessResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg ${
                      result.correct 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 