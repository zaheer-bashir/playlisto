"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface RoundTimerProps {
  startTime: number;
  isPlaying: boolean;
}

export function RoundTimer({ startTime, isPlaying }: RoundTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      const timeElapsed = Date.now() - startTime;
      setElapsed(timeElapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isPlaying]);

  const seconds = Math.floor(elapsed / 1000);
  const milliseconds = Math.floor((elapsed % 1000) / 100);

  return (
    <Badge variant="secondary" className="font-mono">
      {seconds}.{milliseconds}s
    </Badge>
  );
} 