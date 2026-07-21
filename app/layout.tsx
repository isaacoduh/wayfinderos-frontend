import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wayfinder OS", template: "%s · Wayfinder OS" },
  description: "A durable, agentic workspace for planning trips.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className="bg-background">
        <body className="antialiased">
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
