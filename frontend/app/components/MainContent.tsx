'use client';

import type { ReactNode } from 'react';
import { useSidebar } from '../contexts/SidebarContext';

export default function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <main
      className={`ml-16 h-screen overflow-y-auto transition-opacity duration-300 ${
        collapsed ? 'opacity-100' : 'opacity-50 md:opacity-100'
      }`}
    >
      {children}
    </main>
  );
}
