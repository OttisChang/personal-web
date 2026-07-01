'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {}, setCollapsed: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  // 桌面版（>= md 斷點）預設展開；手機版維持預設收合，避免遮住內容
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setCollapsed(false);
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c), setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
