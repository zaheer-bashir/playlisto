import React from "react";

interface PlayersListProps {
  players: any[];
}

const PlayersList = ({ players }: PlayersListProps) => {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Players</h3>
      <div className="space-y-2">
        {players.map((player, index) => (
          <div
            className="flex items-center justify-between p-2 rounded-lg bg-muted"
            key={index}
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
              <span
                className={`text-sm ${
                  player.isReady ? "text-green-500" : "text-muted-foreground"
                }`}
              >
                {player.isReady ? "Ready" : "Not Ready"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayersList;
