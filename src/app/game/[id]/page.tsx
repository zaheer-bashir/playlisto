"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SongSearch } from "@/components/song-search";
import { Badge } from "@/components/ui/badge";
import { RoundTimer } from "@/components/round-timer";
import { useGame } from "./useGame";
import {
  GameHeader,
  GameOverScreen,
  HostControls,
  LoadingScreen,
  ProgressBar,
  Scoreboard,
  RecentGuesses,
  GuessResultFeedback,
} from "@/ui/game";

export default function GamePage() {
  const {
    gameState,
    remainingGuesses,
    guessResults,
    gameStatus,
    spotifyToken,
    isHost,
    snippetDuration,
    currentGuessResult,
    gameOver,
    isConnected,
    handleGuess,
    handleExtendDuration,
    handleSkipRound,
    handleStartRound,
    handleReturnToLobby,
    availableSongs,
    userId,
  } = useGame();

  return (
    <main className="container max-w-7xl mx-auto p-4 md:p-8">
      <div className="min-h-[80vh]">
        {!isConnected ? (
          <LoadingScreen />
        ) : gameOver ? (
          <GameOverScreen
            rankings={gameOver.rankings}
            playlistName={gameOver.playlistName}
            onReturnToLobby={handleReturnToLobby}
          />
        ) : (
          <>
            <Card className="shadow-2xl border-none">
              <GameHeader
                currentRound={gameState.currentRound}
                totalRounds={gameState.totalRounds}
                gameStatus={gameStatus}
              />
              <CardContent className="p-6 space-y-8">
                <ProgressBar
                  currentRound={gameState.currentRound}
                  totalRounds={gameState.totalRounds}
                />

                {isHost && gameState.currentRound > 0 && (
                  <HostControls
                    currentSong={gameState.currentSong}
                    isPlaying={gameState.isPlaying}
                    snippetDuration={snippetDuration}
                    spotifyToken={spotifyToken || ""}
                    availableSongs={availableSongs}
                    onExtendDuration={handleExtendDuration}
                    onSkipRound={handleSkipRound}
                    onStartRound={handleStartRound}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
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
                                variant={
                                  remainingGuesses > 1
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {remainingGuesses} guesses remaining
                              </Badge>
                            </div>
                          </div>
                          {currentGuessResult && (
                            <GuessResultFeedback result={currentGuessResult} />
                          )}
                          <SongSearch
                            spotifyToken={spotifyToken || ""}
                            onGuess={handleGuess}
                            disabled={remainingGuesses <= 0}
                            hasGuessedCorrectly={
                              gameState.players.find((p) => p.userId === userId)
                                ?.hasGuessedCorrectly
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <RecentGuesses guessResults={guessResults} />
                    <Scoreboard players={gameState.players} />
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
