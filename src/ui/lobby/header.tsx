import { Music2, Users } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface LobbyHeaderProps {
  lobbyId: string;
  playerCount: number;
}

const LobbyHeader = ({ lobbyId, playerCount }: LobbyHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="h-6 w-6" />
          <CardTitle>Lobby: {lobbyId}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <span>{playerCount} players</span>
        </div>
      </div>
    </CardHeader>
  );
};

export default LobbyHeader;
