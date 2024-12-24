import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JoinFormProps {
  lobbyCode: string;
  playerName: string;
  isLoading: boolean;
  isValidInput: () => boolean;
  onLobbyCodeChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onJoinLobby: () => void;
  onCreateLobby: () => void;
}

const JoinForm = ({
  lobbyCode,
  playerName,
  isLoading,
  isValidInput,
  onLobbyCodeChange,
  onPlayerNameChange,
  onJoinLobby,
  onCreateLobby,
}: JoinFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <Input
          placeholder="Enter your name (2-20 characters)"
          value={playerName}
          onChange={(e) => onPlayerNameChange(e.target.value)}
          maxLength={20}
          disabled={isLoading}
        />
        {playerName.trim() && playerName.trim().length < 2 && (
          <p className="text-sm text-destructive">
            Name must be at least 2 characters
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Input
          placeholder="Enter lobby code"
          value={lobbyCode}
          onChange={(e) => onLobbyCodeChange(e.target.value.toUpperCase())}
          maxLength={6}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Button
          className="w-full"
          onClick={onJoinLobby}
          disabled={!isValidInput() || !lobbyCode.trim() || isLoading}
        >
          {isLoading ? "Joining..." : "Join Lobby"}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          onClick={onCreateLobby}
          disabled={!isValidInput() || isLoading}
        >
          {isLoading ? "Creating..." : "Create New Lobby"}
        </Button>
      </div>
    </>
  );
};

export default JoinForm;