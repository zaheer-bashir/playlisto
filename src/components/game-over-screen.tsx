import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Home, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameOverProps {
  rankings: {
    rank: number;
    name: string;
    score: number;
    isHost: boolean;
    userId: string;
  }[];
  totalRounds: number;
  playlistName?: string;
  onReturnToLobby: () => void;
}

export function GameOverScreen({ rankings, totalRounds, playlistName, onReturnToLobby }: GameOverProps) {
  const router = useRouter();
  const topThree = rankings.slice(0, 3);
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-8 w-8 text-yellow-400" />;
      case 2:
        return <Medal className="h-7 w-7 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return <Trophy className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center border-b border-border/10">
        <CardTitle className="text-3xl font-bold">Game Over!</CardTitle>
        {playlistName && (
          <p className="text-muted-foreground">Playlist: {playlistName}</p>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {/* Top 3 Podium */}
        <div className="flex justify-center items-end gap-4 h-64 mb-8">
          {topThree.map((player, index) => (
            <div
              key={player.userId}
              className="flex flex-col items-center"
              style={{
                height: `${index === 0 ? '100%' : index === 1 ? '85%' : '70%'}`
              }}
            >
              <div
                className={cn(
                  "flex-1 w-32 flex flex-col items-center justify-end p-4 rounded-t-lg",
                  index === 0 && "bg-yellow-100 dark:bg-yellow-900/30",
                  index === 1 && "bg-gray-100 dark:bg-gray-900/30",
                  index === 2 && "bg-amber-100 dark:bg-amber-900/30"
                )}
              >
                {getRankIcon(index + 1)}
                <span className="font-bold text-lg mt-2">{player.name}</span>
                <span className="text-sm text-muted-foreground">
                  {player.score} points
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Other Players */}
        {rankings.slice(3).length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-lg mb-4">Other Players</h3>
            {rankings.slice(3).map((player) => (
              <div
                key={player.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#{player.rank}</span>
                  <span>{player.name}</span>
                </div>
                <span className="font-medium">{player.score} points</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-4">
          <Button
            variant="outline"
            className="w-48"
            onClick={onReturnToLobby}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Return to Lobby
          </Button>
          <Button
            variant="default"
            className="w-48"
            onClick={() => router.push('/')}
          >
            <Home className="mr-2 h-4 w-4" />
            Exit to Home
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 