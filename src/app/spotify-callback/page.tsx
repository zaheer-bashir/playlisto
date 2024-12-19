"use client";

import useSpotify from "./actions";

export default function SpotifyCallback() {
  useSpotify();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Connecting to Spotify...</p>
    </div>
  );
}
