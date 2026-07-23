import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// Lightweight bilingual (English / Bangla) support for the shop-facing app.
// Translations are written inline at each call site — `t("Orders", "অর্ডার")` —
// so there are no separate dictionary files to keep in sync, and the two
// versions of a string live right next to each other. The choice is per-device
// (localStorage) and defaults to English.

export type Lang = "en" | "bn";

const STORAGE_KEY = "tamurfood-lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Pick the string for the current language. */
  t: (en: string, bn: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function loadLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) === "bn" ? "bn" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode) — language just won't persist
    }
  }, []);

  const toggleLang = useCallback(
    () => setLang(lang === "bn" ? "en" : "bn"),
    [lang, setLang],
  );

  const t = useCallback(
    (en: string, bn: string) => (lang === "bn" ? bn : en),
    [lang],
  );

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LangProvider");
  return ctx;
}
