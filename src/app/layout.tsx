import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiverse Git — Explore your repository's timelines",
  description: "Trace GitHub commit history through the Sacred Timeline, explore Variants, and investigate Incursion Risk in an interactive Git graph.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
