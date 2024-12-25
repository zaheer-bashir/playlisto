import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentGuessesProps {
  guessResults: any[];
}

const RecentGuesses: React.FC<RecentGuessesProps> = ({ guessResults }) => (
  <div className="p-6 bg-secondary/30 rounded-xl">
    <h3 className="font-semibold flex items-center gap-2 text-lg mb-4">
      <MessageSquare className="h-5 w-5 text-primary" />
      Recent Guesses
    </h3>
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {guessResults.map((result, index) => (
        <div
          key={index}
          className={cn(
            "p-2 rounded-lg",
            result.correct
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100"
          )}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium">
                {result.playerName || "Player"}:
              </span>{" "}
              "{result.guess}"
            </div>
            <div className="text-sm">
              {result.correct && (
                <>
                  {result.timeElapsed &&
                    `${(result.timeElapsed / 1000).toFixed(1)}s `}
                  {`(+${result.points} points)`}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default RecentGuesses;
