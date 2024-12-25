import { Crown, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/audio-player";

interface HostControlsProps {
  currentSong?: { id: string };
  isPlaying: boolean;
  snippetDuration: number;
  spotifyToken: string;
  availableSongs: any[];
  onExtendDuration: (additionalTime: number) => void;
  onSkipRound: () => void;
  onStartRound: () => void;
}

const HostControls: React.FC<HostControlsProps> = ({
  currentSong,
  isPlaying,
  snippetDuration,
  spotifyToken,
  availableSongs,
  onExtendDuration,
  onSkipRound,
  onStartRound,
}) => (
  <div className="p-6 bg-secondary/30 rounded-xl space-y-4">
    <h3 className="font-semibold flex items-center gap-2 text-lg">
      <Crown className="h-5 w-5 text-primary" />
      Host Controls
    </h3>
    <div className="flex flex-col gap-4">
      {currentSong && isPlaying && (
        <div className="flex items-center gap-2">
          <AudioPlayer
            songId={currentSong.id}
            duration={snippetDuration}
            onPlaybackComplete={() => {}}
            isHost={true}
            onExtendDuration={onExtendDuration}
            onSkipRound={onSkipRound}
            spotifyToken={spotifyToken}
            showControls={true}
          />
        </div>
      )}
      {!isPlaying && (
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={onStartRound}
          disabled={!availableSongs.length}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Next Round
        </Button>
      )}
    </div>
  </div>
);

export default HostControls;
