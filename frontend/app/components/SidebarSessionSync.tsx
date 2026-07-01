'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSidebar } from '../contexts/SidebarContext';

export default function SidebarSessionSync() {
  const { status } = useSession();
  const { setCollapsed } = useSidebar();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || status === 'loading') return;
    initialized.current = true;
    if (status === 'authenticated') {
      setCollapsed(false);
    }
  }, [status, setCollapsed]);

  return null;
}
