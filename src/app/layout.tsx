import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playlisto",
  description: "A multiplayer song guessing game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
