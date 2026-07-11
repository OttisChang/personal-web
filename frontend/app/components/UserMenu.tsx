"use client"

import { useState } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LogIn, LogOut, Settings } from "lucide-react"

interface UserMenuProps {
  collapsed?: boolean;
  onOpenSettings?: () => void;
}

export default function UserMenu({ collapsed = false, onOpenSettings }: UserMenuProps) {
  const { data: session, status } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useTranslations('userMenu')

  if (status === "loading") {
    return collapsed ? (
      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
    ) : (
      <div className="px-3 py-2 flex items-center gap-2.5 animate-pulse w-full">
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-16" />
        </div>
      </div>
    )
  }

  if (!session) {
    if (collapsed) {
      return (
        <button
          onClick={() => signIn("google")}
          title={t('guestLogin')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <LogIn width={16} height={16} />
        </button>
      )
    }
    return (
      <div className="px-3 py-2 w-full">
        <button
          onClick={() => signIn("google")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {t('guestLogin')}
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div title={`${session.user.name ?? ""} ${session.user.email ?? ""}`}>
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-[var(--border)]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full flex-shrink-0 bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
            {(session.user.name ?? "U")[0].toUpperCase()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full right-1 mb-2 md:bottom-0 md:right-auto md:left-full md:mb-0 md:-ml-3 z-50 w-40 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); onOpenSettings?.(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings width={15} height={15} />
              {t('personalizeSettings')}
            </button>
            <button
              onClick={() => { setMenuOpen(false); signOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border-t border-[var(--border)]"
            >
              <LogOut width={15} height={15} />
              {t('logout')}
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Avatar */}
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-[var(--border)]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full flex-shrink-0 bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
            {(session.user.name ?? "U")[0].toUpperCase()}
          </div>
        )}

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--foreground)] truncate leading-tight">
            {session.user.name}
          </p>
          <p className="text-[10px] text-[var(--muted)] truncate leading-tight">
            {session.user.email}
          </p>
        </div>
      </button>
    </div>
  )
}
