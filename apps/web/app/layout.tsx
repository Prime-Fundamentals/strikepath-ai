import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AuthProvider } from "@/components/AuthProvider";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: { default: "StrikePath AI", template: "%s | StrikePath AI" },
  description: "Dynamic bowling lane tracking, transition visualization, and next-shot recommendations.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#071b31",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <PwaRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
