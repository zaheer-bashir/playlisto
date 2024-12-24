"use client";

import { HomeCard, LobbyForm } from "@/ui/home";
import useHome from "./useHome";

export default function Home() {
  const {
    lobbyCode,
    setLobbyCode,
    playerName,
    setPlayerName,
    isLoading,
    isValidInput,
    handleJoinLobby,
    handleCreateLobby,
  } = useHome();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <HomeCard>
        <LobbyForm
          playerName={playerName}
          lobbyCode={lobbyCode}
          isLoading={isLoading}
          isValidInput={isValidInput}
          onPlayerNameChange={setPlayerName}
          onLobbyCodeChange={setLobbyCode}
          onJoinLobby={handleJoinLobby}
          onCreateLobby={handleCreateLobby}
        />
      </HomeCard>
    </main>
  );
}