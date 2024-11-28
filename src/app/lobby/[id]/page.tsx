"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyAuth } from "@/components/spotify-auth";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Music2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocket } from "@/hooks/useSocket";
import { useUserId } from "@/hooks/useUserId";

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
}

interface Playlist {
  id: string;
  name: string;
  tracks: number | { items: any[] };
  imageUrl?: string;
}

export default function LobbyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const lobbyId = params.id as string;
  const playerName = searchParams.get("name") || "";
  const isHost = searchParams.get("host") === "true";
  const userId = useUserId();

  const [players, setPlayers] = useState<Player[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const { socket, isConnected } = useSocket(
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
  );

  // Add effect to track component mount and initial props
  useEffect(() => {
    console.log("LobbyPage mounted:", {
      lobbyId,
      playerName,
      isHost,
      userId,
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Handle joining lobby
  const joinLobby = useCallback(() => {
    if (!socket || !playerName || !lobbyId || !userId) {
      console.log("Missing required data for joining lobby:", {
        hasSocket: !!socket,
        playerName,
        lobbyId,
        userId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log("Attempting to join lobby:", {
      socketId: socket.id,
      lobbyId,
      playerName,
      isHost,
      userId,
      timestamp: new Date().toISOString(),
    });

    socket.emit("joinLobby", {
      lobbyId,
      playerName,
      isHost,
      userId,
    });
  }, [socket, playerName, lobbyId, isHost, userId]);

  // Add effect to automatically join lobby when dependencies are ready
  useEffect(() => {
    if (socket && isConnected) {
      console.log("Socket connected, attempting to join lobby:", {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      joinLobby();
    }
  }, [socket, isConnected, joinLobby]);

  // Initial join and socket event setup
  useEffect(() => {
    if (!socket || !userId) return;

    console.log("Setting up lobby socket listeners:", {
      socketId: socket.id,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Listen for lobby updates with enhanced logging
    socket.on("lobbyUpdate", (lobby) => {
      console.log("Received lobbyUpdate:", {
        lobbyId: lobby?.id,
        players: lobby?.players?.map((p: Player) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
        })),
        timestamp: new Date().toISOString(),
      });
      setPlayers(lobby.players);
      if (lobby.spotifyPlaylist) {
        setSelectedPlaylist(lobby.spotifyPlaylist);
      }
    });

    // Listen for game start with the complete game data
    socket.on("gameStart", ({ gameState, playlist }) => {
      console.log("Received game start:", {
        hasGameState: !!gameState,
        hasPlaylist: !!playlist,
        playlistId: playlist?.id,
        timestamp: new Date().toISOString(),
      });

      // Navigate to game page without playlist parameter
      router.push(`/game/${lobbyId}`);
    });

    // Listen for errors
    socket.on("error", (message) => {
      alert(message);
      router.push("/");
    });

    // Add connection status logging
    socket.on("connect", () => {
      console.log("Socket connected in lobby:", {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected in lobby:", {
        timestamp: new Date().toISOString(),
      });
    });

    // Listen for game state with complete data
    socket.on("gameState", (gameState) => {
      console.log("🟢 Received game state in lobby:", {
        hasGameState: !!gameState,
        hasPlaylist: !!gameState.playlist,
        hasSong: !!gameState.currentSong,
        timestamp: new Date().toISOString(),
      });

      // Store initial game state in sessionStorage
      sessionStorage.setItem('initialGameState', JSON.stringify(gameState));
      
      // Navigate to game page
      router.push(`/game/${lobbyId}`);
    });

    return () => {
      // Clean up all listeners and leave the lobby
      socket.off("lobbyUpdate");
      socket.off("gameStart");
      socket.off("error");
      socket.emit("leaveLobby", { lobbyId, userId });
    };
  }, [socket, lobbyId, router, joinLobby, userId]);

  // Handle Spotify authentication success
  const handleSpotifyAuth = async (token: string) => {
    try {
      setSpotifyToken(token);

      const response = await fetch(
        "https://api.spotify.com/v1/me/playlists?limit=50",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const formattedPlaylists: Playlist[] = data.items
        .filter((item: any) => item && item.tracks)
        .map((item: any) => ({
          id: item.id,
          name: item.name || "Unnamed Playlist",
          tracks: item.tracks.total || 0,
          imageUrl: item.images?.[0]?.url || null,
        }));

      setPlaylists(formattedPlaylists);
      setShowPlaylistDialog(true);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      alert("Failed to load playlists. Please try again.");
    }
  };

  const handlePlaylistSelect = async (playlist: Playlist) => {
    console.log("Selected playlist:", {
      id: playlist.id,
      name: playlist.name,
      tracks: playlist.tracks,
      timestamp: new Date().toISOString(),
    });

    try {
      // Fetch complete playlist data including tracks
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}`,
        {
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch playlist details");
      }

      const completePlaylist = await response.json();
      console.log("Fetched complete playlist:", {
        id: completePlaylist.id,
        trackCount: completePlaylist.tracks.items.length,
        timestamp: new Date().toISOString(),
      });

      setSelectedPlaylist(completePlaylist); // Store complete playlist data
      setShowPlaylistDialog(false);
    } catch (error) {
      console.error("Error fetching playlist details:", error);
    }
  };

  const handleStartGame = async () => {
    if (!socket || !selectedPlaylist || !spotifyToken) {
      console.error("🔴 Missing required data for game start:", {
        hasSocket: !!socket,
        hasPlaylist: !!selectedPlaylist,
        hasToken: !!spotifyToken,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log("🟡 Starting game with playlist:", {
      playlistId: selectedPlaylist.id,
      playlistName: selectedPlaylist.name,
      trackCount: typeof selectedPlaylist.tracks === 'number' 
        ? selectedPlaylist.tracks 
        : selectedPlaylist.tracks.items.length,
      hasToken: !!spotifyToken,
      timestamp: new Date().toISOString(),
    });

    // Emit start game event
    socket.emit("startGame", {
      lobbyId,
      playlist: selectedPlaylist,
      spotifyToken,
    });
  };

  const handleReady = () => {
    if (!socket) return;
    socket.emit("toggleReady", { lobbyId });
    setIsReady(!isReady);
  };

  // Find the current player to determine their ready status
  const currentPlayer = players.find((p) => p.id === socket?.id);
  const isPlayerReady = currentPlayer?.isReady || false;

  // Update players state effect with more logging
  useEffect(() => {
    console.log("Current players state:", {
      count: players.length,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
      })),
      timestamp: new Date().toISOString(),
    });
  }, [players]);

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
