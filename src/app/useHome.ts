import { useState } from "react";
import { useRouter } from "next/navigation";

const useHome = () => {
  const router = useRouter();
  const [lobbyCode, setLobbyCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValidInput = () => {
    return playerName.trim().length >= 2 && playerName.trim().length <= 20;
  };

  const handleJoinLobby = async () => {
    if (!isValidInput()) return;

    setIsLoading(true);
    try {
      router.push(`/lobby/${lobbyCode}?name=${encodeURIComponent(playerName)}`);
    } catch (error) {
      console.error("Navigation error:", error);
      setIsLoading(false);
    }
  };

  const handleCreateLobby = async () => {
    if (!isValidInput()) return;

    setIsLoading(true);
    try {
      const newLobbyCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      router.push(
        `/lobby/${newLobbyCode}?name=${encodeURIComponent(
          playerName
        )}&host=true`
      );
    } catch (error) {
      console.error("Navigation error:", error);
      setIsLoading(false);
    }
  };

  return {
    lobbyCode,
    setLobbyCode,
    playerName,
    setPlayerName,
    isLoading,
    isValidInput,
    handleJoinLobby,
    handleCreateLobby,
  };
};

export default useHome;
