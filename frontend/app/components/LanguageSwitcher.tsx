'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
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
      className="
        fixed top-4 right-16 z-50
        w-10 h-10 rounded-full
        flex items-center justify-center
        bg-white/90 dark:bg-gray-800/90
        border border-gray-200 dark:border-gray-700
        shadow-md hover:shadow-lg
        text-gray-600 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-700
        backdrop-blur-sm
        transition-all duration-200
        text-xs font-semibold
        disabled:opacity-50
      "
    >
      {locale === 'zh' ? 'EN' : '中'}
    </button>
  );
}
