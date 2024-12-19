import { useEffect } from "react";
import { useRouter } from "next/navigation";

const useSpotify = () => {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const error = params.get("error");
        const state = params.get("state");

        if (error) {
          console.error("Spotify auth error:", error);
          router.replace("/");
          return;
        }

        if (accessToken && state) {
          try {
            const decodedState = JSON.parse(atob(state));
            const returnPath = decodedState.returnPath;

            const returnUrl = new URL(returnPath, window.location.origin);
            returnUrl.searchParams.append("spotify_token", accessToken);

            router.replace(returnUrl.toString());
          } catch (error) {
            console.error("Error parsing state:", error);
            router.replace("/");
          }
        } else {
          router.replace("/");
        }
      } catch (error) {
        console.error("Error in callback:", error);
        router.replace("/");
      }
    };

    handleCallback();
  }, [router]);
};

export default useSpotify;
