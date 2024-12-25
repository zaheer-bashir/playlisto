import { Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HomeCardProps {
  children: React.ReactNode;
}
const HomeCard = ({ children }: HomeCardProps) => {
  return (
    <Card className="max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex justify-center">
          <Music2 className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold text-center">
          Playlisto
        </CardTitle>
        <p className="text-center text-sm text-muted-foreground">
          Join a lobby or create your own to start guessing songs!
        </p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
};

export default HomeCard;
