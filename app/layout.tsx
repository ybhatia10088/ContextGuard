import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextGuard — Memory-safe autonomous operations",
  description: "Persistent-memory safety for autonomous production agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
