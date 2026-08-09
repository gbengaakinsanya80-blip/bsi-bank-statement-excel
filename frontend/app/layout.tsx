import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Bank Statement Intelligence (BSI)",
  description:
    "AI-powered bank statement to Excel converter. Read any PDF bank statement, extract every transaction, validate balances and export clean, structured workbooks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>
            <SiteHeader />
            {children}
          </AuthProvider>
          <footer className="container border-t py-6 text-center text-xs text-muted-foreground">
            Bank Statement Intelligence — AI Bank Statement → Excel Converter
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
