import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AppStateProvider } from "@/lib/app-state";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "RJT SAS PDCA Brain",
  description: "Upload de PDCAs via Excel com persistencia em Supabase"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
