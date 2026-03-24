import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnkiICU - Neurocritical Care Card Generator",
  description: "AI-powered Anki flashcard generator for Neurocritical Care Board Review. Transform textbooks into high-yield study cards with intelligent automation.",
  keywords: ["Anki", "Neurocritical Care", "Medical Education", "Flashcards", "Board Review", "AI", "Medical School", "Neurology"],
  authors: [{ name: "AnkiICU" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "AnkiICU - Neurocritical Care Card Generator",
    description: "AI-powered Anki flashcard generator for Neurocritical Care Board Review",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground",
          "min-h-screen"
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto p-6 lg:p-8 max-w-7xl">
                {children}
              </div>
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
