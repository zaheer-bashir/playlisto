"use client";

import { Music2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyAuth } from "@/components/spotify-auth";
import { Dialog } from "@/components/ui/dialog";
import {
  LobbyHeader,
  HostControls,
  PlayersList,
  PlaylistSelector,
} from "@/ui/lobby";
import useLobby from "./actions";

export default function LobbyPage() {
  const {
    lobbyId,
    players,
    isHost,
    spotifyToken,
    selectedPlaylist,
    showPlaylistDialog,
    handleSpotifyAuth,
    handlePlaylistSelect,
    handleStartGame,
    setShowPlaylistDialog,
    handleReady,
    isPlayerReady,
    playlists,
  } = useLobby();

  return (
    <main className="min-h-screen p-4 bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <LobbyHeader lobbyId={lobbyId} playerCount={players?.length ?? 0} />
          <CardContent className="space-y-4">
            {isHost && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Host Controls</h3>
                {!spotifyToken ? (
                  <SpotifyAuth onSuccess={handleSpotifyAuth} />
                ) : (
                  <HostControls
                    selectedPlaylist={selectedPlaylist}
                    onShowPlaylistDialog={() => setShowPlaylistDialog(true)}
                    onStartGame={handleStartGame}
                    players={players}
                  />
                )}
              </div>
            )}
            <PlayersList players={players} />
            {!isHost && (
              <Button
                className="w-full"
                variant={isPlayerReady ? "outline" : "default"}
                onClick={handleReady}
              >
                {isPlayerReady ? "Not Ready" : "Ready"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <PlaylistSelector
          playlists={playlists}
          handlePlaylistSelect={handlePlaylistSelect}
        />
      </Dialog>
    </main>
  );
}
