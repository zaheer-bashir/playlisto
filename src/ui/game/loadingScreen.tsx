import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
  return (
    <Card className="shadow-2xl border-none">
      <CardContent className="p-8">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg">Loading game...</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoadingScreen;
