"use client";

import { useEffect, useState } from "react";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        // fallback data if API is unavailable
        setProfile({
          name: "個人簡介",
          intro: "您好，我目前任職於金融業，擔任 AI 產品前端開發工程師。",
          experiences: [
            {
              period: "2025年5月 - 現在・1 年",
              company: "凱基金控",
              title: "AI 開發工程師",
              items: [
                "使用 React、Next.js、TypeScript、Tailwind CSS 與 Shadcn UI 開發公司內部 AI 平台，與設計師跨部門協作並客製化元件，從 0 到 1 建構整體前端架構，並成功推動專案通過 POC 與 UAT 驗證。",
                "跨足後端開發，獨立串接 Google Gemini API，實作多模態（Multimodal）圖片辨識與自動摘要功能，成功完成 POC 概念驗證並獲技術主管認可，為內部系統擴展 AI 應用場景。",
                "熟悉 Azure DevOps 自動化部署流程，透過配置環境變數與 Pipeline 維護，加速產品功能的持續迭代與版本交付。",
                "獨立修復專案所有前端 Veracode 弱點並通過 SonarQube Quality Gate 驗證。透過重構邏輯與強化過濾機制，確保平台符合高標準之資安合規與程式碼品質要求。",
              ],
            },
            {
              period: "2024年10月 - 2025年2月・5 個月",
              company: "緯育股份有限公司",
              title: "AI 工程師",
              items: [
                "模型優化：微調 YOLO 模型，提升狗狗情緒辨識的準確度，提供更好的分析結果。",
                "前端開發與部署：獨立開發專案網頁前端（HTML、CSS、JavaScript），並採用響應式設計，使網站可適應桌機、平板與手機等不同裝置。前端部署至 GCP Storage，確保 24 小時穩定存取。",
                "後端開發與 API 設計：使用 Flask 和 Python 開發後端應用，整合 YOLO 影像辨識模型，設計 API 供前端透過 JavaScript Fetch API 發送請求，處理圖片分析並回傳辨識結果。",
                "容器化與雲端部署：透過 Docker 封裝後端應用，並部署至 GCP Cloud Run，提升系統可擴展性與可用性，使狗狗情緒辨識服務可 24 小時穩定運行。",
              ],
            },
            {
              period: "2023年9月 - 2024年10月・1 年 2 個月",
              company: "誠品書店",
              title: "圖書管理專員",
              items: [
                "優化生活風格、心理學、宗教、哲學書區的庫存管理，成功將宗教類書籍庫存天數縮短 50 天，提高資金周轉率。",
                "提供選書建議並協助訂購，成功提升心理學書區月銷售額 10%。",
                "擔任店內值班主管，協調團隊運作，確保顧客服務順暢，並解決突發問題。",
                "成功銷售多項高單價商品（拍立得、精筆、電子閱讀器），助攻門市達成月銷售目標。",
                "分析銷售數據並提出優化策略，使 20 種心理學書籍月銷售量突破 10 本，成功達成個人 OKR。",
              ],
            },
          ],
          education: {
            school: "國立東華大學",
            department: "經濟學系",
            period: "2016 - 2020",
          },
        });
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-gray-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 px-6 py-24">
        {/* decorative glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-400/20 dark:bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full mb-6 shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/20 overflow-hidden">
            <img
              src="/profile.jpg"
              alt="張家瑋"
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              張家瑋 Ottis Chang
            </span>
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
            {loading ? (
              <span className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-80 block" />
            ) : (
              profile?.intro
            )}
          </p>

          {/* Tech tags */}
          <div className="mt-8 flex flex-wrap gap-2">
            {TECH_TAGS.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-16">
        {/* Experience Section */}
        <section>
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white">
            <span className="w-8 h-1 rounded-full bg-indigo-500 inline-block" />
            工作經歷
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
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white">
            <span className="w-8 h-1 rounded-full bg-purple-500 inline-block" />
            學歷
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
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-gray-900 dark:text-white">
            <span className="w-8 h-1 rounded-full bg-indigo-500 inline-block" />
            資格認證
          </h2>

          <div className="flex gap-5">
            <div className="relative flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 z-10 mt-1" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                發照日期 2025年2月・永久有效
              </p>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI 智慧應用開發實戰養成班－500 小時完訓證書
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">緯育股份有限公司</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">
                證照編號：WW25TMAZ01099
              </p>
              <a
                href="/certificate.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-200 max-w-sm"
              >
                <img
                  src="/certificate.png"
                  alt="AI 智慧應用開發實戰養成班完訓證書"
                  className="w-full h-auto object-cover"
                />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-400 dark:text-gray-600 text-sm">
          © {new Date().getFullYear()} Personal Website. Built with Next.js &amp; FastAPI.
        </footer>
      </div>
    </main>
  );
}
