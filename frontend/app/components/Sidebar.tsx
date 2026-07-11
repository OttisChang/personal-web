'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CircleChevronLeft, Clock4, Menu, Search, Settings, Trash2, UserStar } from 'lucide-react';
import { Link } from '../../i18n/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import UserMenu from './UserMenu';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import SettingsDialog from './SettingsDialog';

interface ConversationItem {
  id: string;
  title: string;
  is_pinned: boolean;
  updated_at: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const tNav = useTranslations('nav');
  const tSidebar = useTranslations('sidebar');
  const { data: session, status } = useSession();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const strippedPathname = pathname.replace(/^\/(zh|en)/, '') || '/';
  const isWebSearch = strippedPathname === '/' || strippedPathname.startsWith('/session/');

  const fetchConversations = async (email: string) => {
    try {
      const res = await fetch(`/api/sessions?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      } else {
        console.error('[Sidebar] fetchConversations failed:', res.status, await res.text());
      }
    } catch (err) {
      console.error('[Sidebar] fetchConversations error:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // 頁面載入時撈一次；等 NextAuth session 狀態確定後才判斷是否要撈資料，避免登入狀態還沒解析完就誤判成「尚無對話紀錄」
  useEffect(() => {
    if (!isWebSearch || status === 'loading') return;
    if (!session?.user?.email) {
      setIsLoadingConversations(false);
      return;
    }
    fetchConversations(session.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebSearch, status, session?.user?.email]);

  // 儲存後重新載入
  useEffect(() => {
    if (!isWebSearch || !session?.user?.email) return;
    const email = session.user.email;
    const handler = () => fetchConversations(email);
    window.addEventListener('conversation-saved', handler);
    return () => window.removeEventListener('conversation-saved', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebSearch, session?.user?.email]);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    await fetch(`/api/sessions/${targetId}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== targetId));
    setDeleteTargetId(null);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
    if (strippedPathname === `/session/${targetId}`) {
      router.push('/');
    }
  };

  const NAV_ITEMS = [
    {
      label: tNav('webSearch'),
      href: '/' as const,
      icon: <Search width="18" height="18" />,
    },
    {
      label: tNav('profile'),
      href: '/profile' as const,
      icon: <UserStar width="18" height="18" />,
    },
  ];

  return (
    <>
      {/* Confirm delete dialog */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTargetId(null)} />
          <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center">
              <p className="text-lg font-semibold text-[var(--foreground)]">{tSidebar('deleteConfirm')}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{tSidebar('deleteConfirmDesc')}</p>
            </div>
            <div className="grid grid-cols-2 border-t border-[var(--border)]">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="py-3.5 text-sm font-medium text-[var(--muted)] hover:bg-gray-100 dark:hover:bg-gray-800 border-r border-[var(--border)] transition-colors"
              >
                {tSidebar('cancel')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                {tSidebar('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--foreground)] text-[var(--card)] text-sm px-5 py-2.5 rounded-lg shadow-lg">
            {tSidebar('deletedToast')}
          </div>
        </div>
      )}

      {!collapsed && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full z-50 flex flex-col bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-[80vw] md:w-56'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center h-14 border-b border-[var(--border)] px-3 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <span className="text-sm font-semibold text-[var(--foreground)] truncate select-none">
              © {tSidebar('author')}
            </span>
          )}
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors flex-shrink-0"
            aria-label={collapsed ? tSidebar('expand') : tSidebar('collapse')}
          >
            {collapsed ? (
              <Menu width="18" height="18" />
            ) : (
              <CircleChevronLeft width="18" height="18" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? strippedPathname === '/'
                : strippedPathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="truncate leading-tight">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Conversation History — web-search only */}
        {!collapsed && isWebSearch && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-[var(--border)]">
            <div className="px-4 pt-3 pb-2">
              <span className="text-xs font-semibold text-[var(--muted)] tracking-wide uppercase select-none">
                {tSidebar('history')}
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5 pb-2">
              {isLoadingConversations ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="px-3 py-2.5">
                    <div
                      className="h-3.5 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse"
                      style={{ width: `${85 - i * 10}%` }}
                    />
                  </li>
                ))
              ) : conversations.length === 0 ? (
                <li className="px-3 py-2 text-xs text-[var(--muted)] whitespace-nowrap">
                  {session?.user ? tSidebar('noHistory') : tSidebar('guestHistoryNote')}
                </li>
              ) : (
                conversations.map((conv) => (
                  <li key={conv.id} className="group flex items-center gap-1">
                    <Link
                      href={`/session/${conv.id}`}
                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors min-w-0 ${
                        strippedPathname === `/session/${conv.id}`
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {conv.is_pinned ? (
                        <svg className="flex-shrink-0 text-indigo-400" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                        </svg>
                      ) : (
                        <Clock4 className="flex-shrink-0 text-[var(--muted)]" width="16" height="16" />
                      )}
                      <span className="truncate">{conv.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTargetId(conv.id); }}
                      className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                      title={tSidebar('delete')}
                    >
                      <Trash2 width="16" height="16" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Spacer when no conversation history section */}
        {(collapsed || !isWebSearch) && (
          <div className="flex-1" />
        )}

        {/* Theme / language toggle (collapsed only) + user menu */}
        <div className="flex flex-col">
          {collapsed && (
            <div className="flex flex-col items-center justify-center gap-1 py-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          )}
          {!collapsed && status !== 'loading' && !session && (
            <div className="border-t border-[var(--border)] px-3 pt-3 pb-2">
              <span className="block text-xs font-semibold text-[var(--muted)] tracking-wide uppercase select-none mb-1.5">
                {tSidebar('systemSettings')}
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800 border border-[var(--border)] transition-colors"
              >
                <Settings width={14} height={14} />
                {tSidebar('personalizeSettings')}
              </button>
            </div>
          )}
          <div
            className={`border-t border-[var(--border)] flex items-center ${
              collapsed ? 'justify-center py-2' : 'h-20 px-1'
            }`}
          >
            <UserMenu collapsed={collapsed} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>

      </aside>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
