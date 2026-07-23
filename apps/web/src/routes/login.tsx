import {
  createFileRoute,
  redirect,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session: { role: string } | null };
    if (session) {
      throw redirect({ to: session.role === "admin" ? "/admin" : "/shop" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, lang, toggleLang } = useLang();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.signIn.phoneNumber({
      phoneNumber,
      password,
    });

    if (result.error) {
      setError(
        t("Wrong phone number or password.", "ফোন নম্বর বা পাসওয়ার্ড ভুল।"),
      );
      setLoading(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["session"] });
    const session = await queryClient.fetchQuery({
      queryKey: ["session"],
      queryFn: async () => {
        const res = await api.api.v1.auth.me.$get();
        if (!res.ok) return null;
        return res.json();
      },
    });

    if (session?.role === "admin") {
      router.navigate({ to: "/admin" });
    } else {
      router.navigate({ to: "/shop" });
    }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#faf9f5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 overflow-hidden">
      {/* Subtle Background Glow Spheres */}
      <div
        className="absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundColor: "#c15f3c" }}
      />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full opacity-15 blur-3xl pointer-events-none bg-amber-500" />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-base font-bold text-white shadow-md shadow-amber-900/20 transition-transform group-hover:scale-105"
              style={{ backgroundColor: "#c15f3c" }}
            >
              T
            </span>
            <span className="text-2xl font-serif tracking-tight font-medium">
              Tamurfood
            </span>
          </Link>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t(
              "Neighbourhood Bakery & Instant Shop Delivery",
              "পাড়ার বেকারি ও দ্রুত দোকান ডেলিভারি",
            )}
          </p>
          <button
            type="button"
            onClick={toggleLang}
            className="text-xs font-semibold text-amber-700 dark:text-amber-500 hover:underline"
          >
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
        </div>

        <Card className="border-stone-200/80 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/80 shadow-xl backdrop-blur-md rounded-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-center">
              {t("Sign in to your account", "আপনার অ্যাকাউন্টে সাইন ইন করুন")}
            </CardTitle>
            <CardDescription className="text-center text-xs">
              {t(
                "Enter your registered phone number & password",
                "আপনার নিবন্ধিত ফোন নম্বর ও পাসওয়ার্ড দিন",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="phoneNumber"
                  className="text-xs font-medium text-stone-700 dark:text-stone-300"
                >
                  {t("Phone Number", "ফোন নম্বর")}
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="01700000000"
                  autoComplete="username"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="rounded-xl border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 focus-visible:ring-amber-600/30"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    {t("Password", "পাসওয়ার্ড")}
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-amber-700 dark:text-amber-500 hover:underline font-medium"
                  >
                    {t("Forgot?", "ভুলে গেছেন?")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 focus-visible:ring-amber-600/30"
                />
              </div>
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full rounded-xl py-2.5 font-semibold text-white shadow-md shadow-amber-900/15 transition-all hover:brightness-105 active:scale-[0.99]"
                style={{ backgroundColor: "#c15f3c" }}
                disabled={loading}
              >
                {loading
                  ? t("Signing in...", "সাইন ইন হচ্ছে...")
                  : t("Sign In", "সাইন ইন")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            to="/"
            className="text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            ← {t("Back to Home", "হোমে ফিরুন")}
          </Link>
        </div>
      </div>
    </div>
  );
}
