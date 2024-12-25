import { cn } from "@/lib/utils";

interface GuessResult {
  correct: boolean;
  message: string;
  points?: number;
}

interface GuessResultFeedbackProps {
  result: GuessResult;
}

const GuessResultFeedback = ({ result }: GuessResultFeedbackProps) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md text-sm font-medium mb-3 animate-in fade-in slide-in-from-top-1",
        result.correct
          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-100"
          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-100"
      )}
    >
      <div className="flex items-center justify-between">
        <span>{result.message}</span>
        {result.points && (
          <span className="font-bold">+{result.points} points</span>
        )}
      </div>
    </div>
  );
};

export default GuessResultFeedback;
