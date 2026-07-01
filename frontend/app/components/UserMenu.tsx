"use client"

import { useSession, signOut } from "next-auth/react"

export default function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="px-3 py-2 flex items-center gap-2.5 animate-pulse">
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-16" />
        </div>
      </div>
    )
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
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

      {/* Logout button */}
      <button
        onClick={() => signOut()}
        title="登出"
        className="flex-shrink-0 p-1 rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  )
}
