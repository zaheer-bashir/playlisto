import { Trophy, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Player {
  id: string;
  name: string;
  score?: number;
  isHost: boolean;
}

interface ScoreboardProps {
  players: Player[];
}

const Scoreboard: React.FC<ScoreboardProps> = ({ players }) => (
  <div className="p-6 bg-secondary/30 rounded-xl">
    <h3 className="font-semibold flex items-center gap-2 text-lg mb-4">
      <Trophy className="h-5 w-5 text-primary" />
      Scoreboard
    </h3>
    <div className="space-y-3">
      {players
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((player, index) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              {index === 0 && <Crown className="h-4 w-4 text-primary" />}
              <span>{player.name}</span>
              {player.isHost && (
                <Badge variant="secondary" className="text-xs">
                  Host
                </Badge>
              )}
            </div>
            <span className="font-medium">{player.score || 0} points</span>
          </div>
        ))}
    </div>
  </div>
);

export default Scoreboard;
