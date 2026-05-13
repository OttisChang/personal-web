'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

export default function LocaleHtmlUpdater() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-TW' : 'en';
  }, [locale]);
  return null;
}
