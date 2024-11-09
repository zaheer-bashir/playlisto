"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Music2 } from "lucide-react"; // Import music icon
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [lobbyCode, setLobbyCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinLobby = async () => {
    if (!isValidInput()) return;
    
    setIsLoading(true);
    try {
      router.push(`/lobby/${lobbyCode}?name=${encodeURIComponent(playerName)}`);
    } catch (error) {
      console.error('Navigation error:', error);
      setIsLoading(false);
    }
  };

  const handleCreateLobby = async () => {
    if (!isValidInput()) return;
    
    setIsLoading(true);
    try {
      const newLobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      router.push(`/lobby/${newLobbyCode}?name=${encodeURIComponent(playerName)}&host=true`);
    } catch (error) {
      console.error('Navigation error:', error);
      setIsLoading(false);
    }
  };

  const isValidInput = () => {
    return playerName.trim().length >= 2 && playerName.trim().length <= 20;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex justify-center">
            <Music2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Playlisto
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Join a lobby or create your own to start guessing songs!
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Enter your name (2-20 characters)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              disabled={isLoading}
            />
            {playerName.trim() && playerName.trim().length < 2 && (
              <p className="text-sm text-destructive">Name must be at least 2 characters</p>
            )}
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Enter lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              maxLength={6}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Button 
              className="w-full" 
              onClick={handleJoinLobby}
              disabled={!isValidInput() || !lobbyCode.trim() || isLoading}
            >
              {isLoading ? "Joining..." : "Join Lobby"}
            </Button>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={handleCreateLobby}
              disabled={!isValidInput() || isLoading}
            >
              {isLoading ? "Creating..." : "Create New Lobby"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
} 