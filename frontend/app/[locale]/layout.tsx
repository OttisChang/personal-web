import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '../../i18n/routing';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LocaleHtmlUpdater from '../components/LocaleHtmlUpdater';
import Sidebar from '../components/Sidebar';
import MainContent from '../components/MainContent';
import { SidebarProvider } from '../contexts/SidebarContext';
import SidebarSessionSync from '../components/SidebarSessionSync';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'zh' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleHtmlUpdater />
      <ThemeToggle />
      <LanguageSwitcher />
      <SidebarProvider>
        <SidebarSessionSync />
        <div className="h-screen overflow-hidden">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
      </SidebarProvider>
    </NextIntlClientProvider>
  );
}
