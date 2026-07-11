"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function Greeting() {
  const { data: session, status } = useSession();
  const t = useTranslations("webSearch");
  const [greeting, setGreeting] = useState<string | null>(null);

  // 等 Google OAuth 的使用者資料確定後（loading 結束）再挑選 greeting，
  // 有名字時套用帶名字的版本，否則使用一般版本
  useEffect(() => {
    if (status === "loading") return;
    const userName = session?.user?.name;
    const greetings = (userName ? t.raw("greetingsWithName") : t.raw("greetings")) as string[];
    const template = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(userName ? template.replace("{name}", userName) : template);
  }, [status, session?.user?.name]);

  if (!greeting) return null;

  return (
    <h2
      key={greeting}
      className="animate-greeting-wipe text-xl sm:text-2xl font-semibold text-[var(--foreground)] mb-6 text-center"
    >
      {greeting}
    </h2>
  );
}
