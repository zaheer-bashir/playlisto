import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useUserId } from "@/hooks/useUserId";

interface Player {
  id: string;
  userId?: string;
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

const useLobby = () => {
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
  }, [lobbyId, playerName, isHost, userId]);

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

    // Clear any existing game state when returning to lobby
    sessionStorage.removeItem("initialGameState");

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
      sessionStorage.setItem("initialGameState", JSON.stringify(gameState));

      // Navigate to game page
      router.push(`/game/${lobbyId}`);
    });

    // Add reconnection handler for returning players
    socket.on("lobbyUpdate", (lobby) => {
      console.log("Received lobbyUpdate in lobby:", {
        lobbyId: lobby?.id,
        players: lobby?.players?.map((p: Player) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
        })),
        timestamp: new Date().toISOString(),
      });

      setPlayers(lobby.players);

      // Restore playlist selection for host if it exists
      if (lobby.spotifyPlaylist && isHost) {
        setSelectedPlaylist(lobby.spotifyPlaylist);
      }

      // Reset ready state
      const currentPlayer = lobby.players.find(
        (p: Player) => p.userId === userId
      );
      if (currentPlayer) {
        setIsReady(currentPlayer.isReady);
      }
    });

    return () => {
      // Clean up all listeners and leave the lobby
      socket.off("lobbyUpdate");
      socket.off("gameStart");
      socket.off("error");
      socket.emit("leaveLobby", { lobbyId, userId });
    };
  }, [socket, lobbyId, router, joinLobby, userId, isHost]);

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
      trackCount:
        typeof selectedPlaylist.tracks === "number"
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

  return {
    lobbyId,
    players,
    isHost,
    spotifyToken,
    selectedPlaylist,
    showPlaylistDialog,
    handleSpotifyAuth,
    handlePlaylistSelect,
    handleStartGame,
    handleReady,
    setShowPlaylistDialog,
    playlists,
    isPlayerReady,
  };
};

export default useLobby;
