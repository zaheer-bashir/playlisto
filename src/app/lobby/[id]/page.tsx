"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotifyAuth } from "@/components/spotify-auth";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Music2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSocket } from '@/hooks/useSocket';
import { useUserId } from '@/hooks/useUserId';

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
}

interface Playlist {
  id: string;
  name: string;
  tracks: number;
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
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const socket = useSocket(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');

  // Handle joining lobby
  const joinLobby = useCallback(() => {
    if (!socket || !playerName || !lobbyId || !userId) return;
    console.log('Joining lobby:', { lobbyId, playerName, isHost, userId });
    socket.emit('joinLobby', {
      lobbyId,
      playerName,
      isHost,
      userId
    });
  }, [socket, playerName, lobbyId, isHost, userId]);

  // Initial join and socket event setup
  useEffect(() => {
    if (!socket || !userId) return;

    // Only join if we're not already connected
    if (!socket.connected) {
      joinLobby();
    }

    // Listen for lobby updates
    socket.on('lobbyUpdate', (lobby) => {
      console.log('Received lobby update:', lobby);
      setPlayers(lobby.players);
      if (lobby.spotifyPlaylist) {
        setSelectedPlaylist(lobby.spotifyPlaylist);
      }
    });

    // Listen for game start
    socket.on('gameStart', (playlist) => {
      router.push(`/game/${lobbyId}?playlist=${playlist.id}`);
    });

    // Listen for errors
    socket.on('error', (message) => {
      alert(message);
      router.push('/');
    });

    return () => {
      // Clean up all listeners and leave the lobby
      socket.off('lobbyUpdate');
      socket.off('gameStart');
      socket.off('error');
      socket.emit('leaveLobby', { lobbyId, userId });
    };
  }, [socket, lobbyId, router, joinLobby, userId]);

  // Handle Spotify authentication success
  const handleSpotifyAuth = async (token: string) => {
    try {
      setSpotifyToken(token);
      
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const formattedPlaylists: Playlist[] = data.items
        .filter((item: any) => item && item.tracks)
        .map((item: any) => ({
          id: item.id,
          name: item.name || 'Unnamed Playlist',
          tracks: item.tracks.total || 0,
          imageUrl: item.images?.[0]?.url || null
        }));

      setPlaylists(formattedPlaylists);
      setShowPlaylistDialog(true);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      alert('Failed to load playlists. Please try again.');
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    if (!socket) return;
    setSelectedPlaylist(playlist);
    setShowPlaylistDialog(false);
    socket.emit('updatePlaylist', { 
      lobbyId,
      playlist: {
        id: playlist.id,
        name: playlist.name
      }
    });
  };

  const handleStartGame = () => {
    if (!socket || !selectedPlaylist) return;
    socket.emit('startGame', { lobbyId });
  };

  const handleReady = () => {
    if (!socket) return;
    socket.emit('toggleReady', { lobbyId });
    setIsReady(!isReady);
  };

  // Find the current player to determine their ready status
  const currentPlayer = players.find(p => p.id === socket?.id);
  const isPlayerReady = currentPlayer?.isReady || false;

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
                            <p className="font-medium">{selectedPlaylist.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedPlaylist.tracks} tracks
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
                      disabled={!selectedPlaylist || !players.filter(p => !p.isHost).every(p => p.isReady)}
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
                      <span className={`text-sm ${player.isReady ? "text-green-500" : "text-yellow-500"}`}>
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
                    {playlist.tracks} tracks
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