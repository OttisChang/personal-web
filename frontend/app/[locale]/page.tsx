"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useSidebar } from "../contexts/SidebarContext";

interface Experience {
  period: string;
  company: string;
  title: string;
  items: string[];
}

interface Education {
  school: string;
  department: string;
  period: string;
}

interface Profile {
  name: string;
  intro: string;
  experiences: Experience[];
  education: Education;
}

const TECH_TAGS = [
  "Python", "MySQL", "Tableau", "Power BI",
  "GCP", "Azure", "Github Actions",
  "HTML", "CSS", "JavaScript",
  "React", "Next.js", "TypeScript", "Tailwind CSS", "Shadcn UI",
  "Flask", "YOLO", "Deep Learning",
  "Git", "Github",
  "LLM API", "RAG", "AI Agent", "Flowise", "n8n",
];


function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 dark:border-indigo-500/20">
      {label}
    </span>
  );
}

function TimelineDot() {
  return (
    <div className="relative flex flex-col items-center">
      <div className="w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 z-10 mt-1" />
      <div className="w-px flex-1 bg-gradient-to-b from-indigo-500/40 to-transparent mt-2" />
    </div>
  );
}

export default function Home() {
  const { collapsed } = useSidebar();
  const t = useTranslations('home');
  const locale = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/profile?lang=${locale}`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [locale]);

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">無法載入資料，請確認後端服務是否正常運行。</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Hero Section */}
      <section className={`relative overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-gray-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 ${collapsed ? 'px-6 py-24' : 'px-4 sm:px-6 py-14 sm:py-20'}`}>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-400/20 dark:bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          <div className="w-20 h-20 rounded-full mb-6 shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/20 overflow-hidden">
            <Image
              src="/ottis-profile.jpg"
              alt="張家瑋"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>

          <h1 className={`font-bold tracking-tight mb-4 ${collapsed ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl md:text-5xl'}`}>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {locale === 'en' ? 'Ottis Chang' : '張家瑋 Ottis Chang'}
            </span>
          </h1>

          <p className={`text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl ${collapsed ? 'text-lg' : 'text-base sm:text-lg'}`}>
            {loading ? (
              <span className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-80 block" />
            ) : (
              profile?.intro
            )}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {TECH_TAGS.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        </div>
      </section>

      <div className={`max-w-3xl mx-auto py-16 space-y-16 ${collapsed ? 'px-6' : 'px-4 sm:px-6'}`}>
        {/* Experience Section */}
        <section>
          <h2 className={`font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white ${collapsed ? 'text-2xl' : 'text-xl sm:text-2xl'}`}>
            <span className="w-8 h-1 rounded-full bg-indigo-500 inline-block" />
            {t('experience')}
          </h2>

          {loading ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-40" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-64" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {profile?.experiences.map((exp, idx) => (
                <div key={idx} className="flex gap-5">
                  <TimelineDot />
                  <div className="pb-2 flex-1">
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                      {exp.period}
                    </p>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {exp.company}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{exp.title}</p>
                    <ul className="space-y-2">
                      {exp.items.map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-gray-600 dark:text-gray-300 text-sm leading-relaxed"
                        >
                          <span className="text-indigo-500 mt-1 shrink-0">▸</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Education Section */}
        <section>
          <h2 className={`font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white ${collapsed ? 'text-2xl' : 'text-xl sm:text-2xl'}`}>
            <span className="w-8 h-1 rounded-full bg-purple-500 inline-block" />
            {t('education')}
          </h2>

          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32" />
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-56" />
            </div>
          ) : (
            <div className="flex gap-5">
              <div className="relative flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-purple-500 ring-4 ring-purple-500/20 z-10 mt-1" />
              </div>
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">
                  {profile?.education.period}
                </p>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {profile?.education.school}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {profile?.education.department}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Certification Section */}
        <section>
          <h2 className={`font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white ${collapsed ? 'text-2xl' : 'text-xl sm:text-2xl'}`}>
            <span className="w-8 h-1 rounded-full bg-indigo-500 inline-block" />
            {t('certification')}
          </h2>

          <div className="flex gap-5">
            <div className="relative flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 z-10 mt-1" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                {t('certIssuedDate')}
              </p>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('certTitle')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('certCompany')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">
                {t('certNumber')}
              </p>
              <a
                href="/certificate.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-200 max-w-sm"
              >
                <img
                  src="/certificate.png"
                  alt={t('certTitle')}
                  className="w-full h-auto object-cover"
                />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-400 dark:text-gray-600 text-sm">
          {t('footer', { year: new Date().getFullYear() })}
        </footer>
      </div>
    </main>
  );
}
