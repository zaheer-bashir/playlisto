interface ProgressBarProps {
  currentRound: number;
  totalRounds: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentRound,
  totalRounds,
}) => {
  return (
    <div className="w-full bg-secondary/50 rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-500"
        style={{
          width: `${(currentRound / totalRounds) * 100}%`,
        }}
      />
    </div>
  );
};

export default ProgressBar;
