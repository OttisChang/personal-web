import type { ReactNode } from 'react';
import './globals.css';
import SessionProviderWrapper from './components/SessionProviderWrapper';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body
        className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased"
        suppressHydrationWarning
      >
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
