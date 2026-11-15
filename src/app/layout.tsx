import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import "@xyflow/react/dist/style.css";

export const metadata: Metadata = {
  title: {
    default: "Buying Signal Radar — discover who might need you, why now, and who could introduce you",
    template: "%s · Buying Signal Radar",
  },
  description:
    "Describe what you sell. Buying Signal Radar extracts your ICP, finds evidence-backed buying signals and maps warm introduction paths. Open source GTM engineering.",
  applicationName: "Buying Signal Radar",
  openGraph: {
    title: "Buying Signal Radar",
    description: "Tell us what you sell. Discover who might need it, why now, and who could introduce you.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0d1218",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e7edf4",
            },
          }}
        />
      </body>
    </html>
  );
}
