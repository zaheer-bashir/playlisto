import React from "react";
import { Button } from "@/components/ui/button";
import { Playlist } from "@/types/lobby";

interface HostControlsProps {
  selectedPlaylist: Playlist | null;
  onShowPlaylistDialog: () => void;
  onStartGame: () => void;
  players: any[];
}

const HostControls = ({
  selectedPlaylist,
  onShowPlaylistDialog,
  onStartGame,
  players,
}: HostControlsProps) => (
  <div className="space-y-4">
    {selectedPlaylist ? (
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium">{selectedPlaylist.name}</h4>
          <p className="text-sm text-muted-foreground">
            {typeof selectedPlaylist.tracks === 'number' ? selectedPlaylist.tracks : 0} tracks
          </p>
        </div>
        <Button variant="outline" onClick={onShowPlaylistDialog}>
          Change Playlist
        </Button>
      </div>
    ) : (
      <Button className="w-full" onClick={onShowPlaylistDialog}>
        Select Playlist
      </Button>
    )}
    <Button
      className="w-full"
      disabled={
        !selectedPlaylist ||
        !players.filter((p) => !p.isHost).every((p) => p.isReady)
      }
      onClick={onStartGame}
    >
      Start Game
    </Button>
  </div>
);

export default HostControls;
