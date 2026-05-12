import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";
import Sidebar from "./components/Sidebar";
import { SidebarProvider } from "./contexts/SidebarContext";

export const metadata: Metadata = {
  title: "張家瑋 Ottis Chang | AI 工程師",
  description: "張家瑋 Ottis Chang - AI 工程師的個人介紹網站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      {/* 防閃爍腳本：在頁面渲染前就套用正確的 dark class */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased" suppressHydrationWarning>
        <ThemeToggle />
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
