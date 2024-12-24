import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Playlist } from "@/types/lobby";

interface PlaylistSelectorProps {
  playlists: Playlist[];
  handlePlaylistSelect: (playlist?: Playlist) => void;
}

const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({
  playlists,
  handlePlaylistSelect,
}) => {
  return (
    <DialogContent className="!max-w-3xl overflow-hidden overflow-y-auto" style={{ height: '80vh' }}>
      <DialogHeader>
        <DialogTitle>Select a Playlist</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {playlists.map((playlist: Playlist) => (
          <Button
            key={playlist.id}
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-2"
            onClick={() => handlePlaylistSelect(playlist)}
          >
            {playlist.imageUrl && (
              <Image
                src={playlist.imageUrl}
                alt={playlist.name}
                width={100}
                height={100}
                loading="lazy"
                className="w-full aspect-square object-cover rounded-md"
              />
            )}
            <div className="text-left">
              <p className="font-medium">{playlist.name}</p>
              <p className="text-sm text-muted-foreground">
                {typeof playlist.tracks === "number"
                  ? playlist.tracks
                  : playlist.tracks.items?.length || 0}{" "}
                tracks
              </p>
            </div>
          </Button>
        ))}
      </div>
    </DialogContent>
  );
};

export default PlaylistSelector;
