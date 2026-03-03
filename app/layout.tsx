import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fristvakt – Never miss a trial deadline",
  description:
    "Forward your subscription emails to your unique Fristvakt address and we'll track trial deadlines and upcoming charges for you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
