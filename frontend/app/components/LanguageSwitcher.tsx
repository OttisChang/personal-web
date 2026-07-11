'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = locale === 'zh' ? 'en' : 'zh';
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-label={locale === 'zh' ? 'Switch to English' : '切換為中文'}
      title={locale === 'zh' ? 'Switch to English' : '切換為中文'}
      className={`
        w-8 h-8 rounded-lg flex-shrink-0
        flex items-center justify-center
        text-[var(--muted)] hover:text-[var(--foreground)]
        hover:bg-[var(--accent-soft)]
        transition-colors duration-200
        text-xs font-semibold
        disabled:opacity-50
        ${className}
      `}
    >
      {locale === 'zh' ? 'EN' : '中'}
    </button>
  );
}
