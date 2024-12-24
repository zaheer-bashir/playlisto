import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useUserId } from "@/hooks/useUserId";
import { createSpotifyService } from "@/services/spotify";

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
  tracks: number | { items: any[]; length?: number };
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

  const joinLobby = useCallback(() => {
    if (!socket || !playerName || !lobbyId || !userId) return;

    socket.emit("joinLobby", {
      lobbyId,
      playerName,
      isHost,
      userId,
    });
  }, [socket, playerName, lobbyId, isHost, userId]);

  useEffect(() => {
    if (socket && isConnected) {
      joinLobby();
    }
  }, [socket, isConnected, joinLobby]);

  useEffect(() => {
    if (!socket || !userId) return;

    sessionStorage.removeItem("initialGameState");

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

    socket.on("gameStart", ({ gameState, playlist }) => {
      console.log("Received game start:", {
        hasGameState: !!gameState,
        hasPlaylist: !!playlist,
        playlistId: playlist?.id,
        timestamp: new Date().toISOString(),
      });

      router.push(`/game/${lobbyId}`);
    });

    socket.on("error", (message) => {
      alert(message);
      router.push("/");
    });

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

    socket.on("gameState", (gameState) => {
      console.log("🟢 Received game state in lobby:", {
        hasGameState: !!gameState,
        hasPlaylist: !!gameState.playlist,
        hasSong: !!gameState.currentSong,
        timestamp: new Date().toISOString(),
      });

      sessionStorage.setItem("initialGameState", JSON.stringify(gameState));

      router.push(`/game/${lobbyId}`);
    });

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
      socket.off("lobbyUpdate");
      socket.off("gameStart");
      socket.off("error");
      socket.emit("leaveLobby", { lobbyId, userId });
    };
  }, [socket, lobbyId, router, joinLobby, userId, isHost]);

  const handleSpotifyAuth = async (token: string) => {
    try {
      setSpotifyToken(token);
      const spotifyService = createSpotifyService(token);
      const playlists: any[] = await spotifyService.getPlaylists();
      setPlaylists(playlists);
      setShowPlaylistDialog(true);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      alert("Failed to load playlists. Please try again.");
    }
  };

  const handlePlaylistSelect: any = async (playlist: Playlist) => {
    try {
      const spotifyService = createSpotifyService(spotifyToken!);
      const completePlaylist: any = await spotifyService.getPlaylistDetails(
        playlist.id
      );
      setSelectedPlaylist(completePlaylist);
      setShowPlaylistDialog(false);
    } catch (error) {
      console.error("Error fetching playlist details:", error);
    }
  };

  const handleStartGame = async () => {
    if (!socket || !selectedPlaylist || !spotifyToken) return;

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

  const currentPlayer = players.find((p) => p.id === socket?.id);
  const isPlayerReady = currentPlayer?.isReady || false;

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
