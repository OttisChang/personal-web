'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CircleChevronLeft, Clock4, Menu, Search, Trash2, UserStar } from 'lucide-react';
import { Link } from '../../i18n/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import UserMenu from './UserMenu';

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
          <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-6 w-72 flex flex-col gap-4">
            <p className="text-sm font-medium text-[var(--foreground)]">確認要刪除此對話嗎？</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--foreground)] text-[var(--card)] text-sm px-5 py-2.5 rounded-lg shadow-lg">
            已刪除對話
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
                對話紀錄
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
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
                <li className="px-3 py-2 text-xs text-[var(--muted)]">
                  {session?.user ? '尚無對話紀錄' : '登入後儲存對話'}
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
                      title="刪除"
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

        {/* User menu */}
        {!collapsed && (
          <div className="border-t border-[var(--border)] h-20 flex items-center px-1">
            <UserMenu />
          </div>
        )}

      </aside>
    </>
  );
}
