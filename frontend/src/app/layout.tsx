import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Distributed Job Execution Platform Dashboard",
  description: "Production-grade distributed system worker orchestration monitor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col`}>
        {/* Navigation Header */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                DISTRIBUTED JOB SYSTEM
              </span>
            </div>
            
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="hover:text-indigo-400 transition-colors">
                Dashboard
              </Link>
              <Link href="/jobs" className="hover:text-indigo-400 transition-colors">
                Jobs List
              </Link>
              <Link href="/workers" className="hover:text-indigo-400 transition-colors">
                Worker Nodes
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          Distributed Job Execution Platform &bull; Staff Engineer Assessment Workspace
        </footer>
      </body>
    </html>
  );
}
