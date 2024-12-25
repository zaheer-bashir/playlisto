import React from "react";
import { Music2 } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface GameHeaderProps {
  currentRound: number;
  totalRounds: number;
  gameStatus: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  currentRound,
  totalRounds,
  gameStatus,
}) => {
  return (
    <CardHeader className="border-b border-border/10">
      <div className="flex justify-between items-center">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Music2 className="h-7 w-7 text-primary" />
          Round {currentRound} of {totalRounds}
        </CardTitle>
        <span className="text-sm font-medium px-4 py-1.5 rounded-full bg-secondary/50">
          {gameStatus}
        </span>
      </div>
    </CardHeader>
  );
};

export default GameHeader;
