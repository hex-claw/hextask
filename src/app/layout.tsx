import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HexTask | J + Hex Co-working",
  description: "Task management for human-AI collaboration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
