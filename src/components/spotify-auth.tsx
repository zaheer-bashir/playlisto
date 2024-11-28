"use client";

import { Button } from "@/components/ui/button";
import { FaSpotify } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";

interface SpotifyAuthProps {
  onSuccess: (accessToken: string) => void;
}

export function SpotifyAuth({ onSuccess }: SpotifyAuthProps) {
  const [redirectUri, setRedirectUri] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    // Check for spotify_token in URL parameters
    const spotifyToken = searchParams.get("spotify_token");
    if (spotifyToken) {
      onSuccess(spotifyToken);
    }
  }, [searchParams, onSuccess]);

  useEffect(() => {
    const envRedirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;
    setRedirectUri(
      envRedirectUri || `${window.location.origin}/spotify-callback`
    );
  }, []);

  const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  useEffect(() => {
    if (!CLIENT_ID) {
      console.error(
        "Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID in environment variables"
      );
      setError("Spotify configuration error");
    }
  }, [CLIENT_ID]);

  const SCOPES = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-private",
    "user-read-email",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
  ].join(" ");

  const handleLogin = () => {
    if (!redirectUri) {
      setError("Redirect URI not set");
      return;
    }

    if (!CLIENT_ID) {
      setError("Spotify Client ID not configured");
      return;
    }

    try {
      const authUrl = new URL("https://accounts.spotify.com/authorize");

      // Add state parameter for security and include the return path
      const state = JSON.stringify({
        returnPath: pathname + window.location.search,
      });
      const encodedState = btoa(state);

      const params = {
        client_id: CLIENT_ID,
        response_type: "token",
        redirect_uri: redirectUri,
        scope: SCOPES,
        state: encodedState,
        show_dialog: "true",
      };

      // Build the URL with parameters
      Object.entries(params).forEach(([key, value]) => {
        authUrl.searchParams.append(key, value);
      });

      // Redirect to Spotify auth
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error("Error during Spotify auth:", err);
      setError("Failed to initiate Spotify login");
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleLogin}
        className="w-full flex items-center gap-2"
        disabled={!redirectUri || !CLIENT_ID}
      >
        <FaSpotify className="h-5 w-5" />
        Connect Spotify Account
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
