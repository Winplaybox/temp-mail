"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dictionaries, type Dict, type Lang } from "@/lib/i18n";

type Theme = "light" | "dark";
type Toast = { id: number; text: string; tone: "ok" | "error" };

type Ctx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  toast: (text: string, tone?: "ok" | "error") => void;
};

const AppContext = createContext<Ctx | null>(null);

function read<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    setLangState(read<Lang>("wpb.tm.lang", ["en", "hi"], navigator.language.startsWith("hi") ? "hi" : "en"));
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(read<Theme>("wpb.tm.theme", ["light", "dark"], prefersDark ? "dark" : "light"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("wpb.tm.lang", l);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("wpb.tm.theme", next);
      } catch {}
      return next;
    });
  }, []);

  const toast = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), tone === "error" ? 5000 : 2200);
  }, []);

  const value = useMemo(
    () => ({ lang, t: dictionaries[lang], setLang, theme, toggleTheme, toast }),
    [lang, setLang, theme, toggleTheme, toast],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.tone}`}>
            {x.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside Providers");
  return ctx;
}
