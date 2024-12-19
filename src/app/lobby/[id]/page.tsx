"use client";

import { Music2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyAuth } from "@/components/spotify-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 className="h-6 w-6" />
                <CardTitle>Lobby: {lobbyId}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{players.length} players</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Host Controls */}
            {isHost && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Host Controls</h3>
                {!spotifyToken ? (
                  <SpotifyAuth onSuccess={handleSpotifyAuth} />
                ) : (
                  <div className="space-y-2">
                    {selectedPlaylist ? (
                      <div className="flex items-center justify-between p-2 bg-background rounded-lg">
                        <div className="flex items-center gap-2">
                          {selectedPlaylist.imageUrl && (
                            <img
                              src={selectedPlaylist.imageUrl}
                              alt={selectedPlaylist.name}
                              className="w-10 h-10 rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">
                              {selectedPlaylist.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {typeof selectedPlaylist.tracks === "number"
                                ? selectedPlaylist.tracks
                                : selectedPlaylist.tracks.items.length}{" "}
                              tracks
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setShowPlaylistDialog(true)}
                        >
                          Change Playlist
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setShowPlaylistDialog(true)}
                      >
                        Select Playlist
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      disabled={
                        !selectedPlaylist ||
                        !players
                          .filter((p) => !p.isHost)
                          .every((p) => p.isReady)
                      }
                      onClick={handleStartGame}
                    >
                      Start Game
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Players List */}
            <div className="space-y-2">
              <h3 className="font-semibold">Players</h3>
              <div className="space-y-2">
                {players.map((player) => (
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
                    {!player.isHost && (
                      <span
                        className={`text-sm ${
                          player.isReady ? "text-green-500" : "text-yellow-500"
                        }`}
                      >
                        {player.isReady ? "Ready" : "Not Ready"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ready Button (for non-host players) */}
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

      {/* Playlist Selection Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Playlist</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {playlists.map((playlist) => (
              <Button
                key={playlist.id}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => handlePlaylistSelect(playlist)}
              >
                {playlist.imageUrl && (
                  <img
                    src={playlist.imageUrl}
                    alt={playlist.name}
                    className="w-full aspect-square object-cover rounded-md"
                  />
                )}
                <div className="text-left">
                  <p className="font-medium">{playlist.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {typeof playlist.tracks === "number"
                      ? playlist.tracks
                      : playlist.tracks.items.length}{" "}
                    tracks
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
