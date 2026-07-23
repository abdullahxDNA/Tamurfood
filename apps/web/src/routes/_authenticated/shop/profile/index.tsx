import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, User, Phone, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/shop/profile/")({
  component: ShopProfilePage,
});

const CLAY = "#c15f3c";
const inputClass =
  "rounded-xl border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 focus-visible:ring-amber-600/30";

function ShopProfilePage() {
  const { t } = useLang();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: shopInfo } = useQuery({
    queryKey: ["shop-me"],
    queryFn: async () => {
      const res = await api.api.v1.shops.me.$get();
      if (!res.ok) throw new Error("Failed to load shop info");
      return res.json();
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error(
        t(
          "New password must be at least 6 characters.",
          "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
        ),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        t("New passwords do not match.", "নতুন পাসওয়ার্ড দুটি মেলেনি।"),
      );
      return;
    }

    setLoading(true);

    const res = await api.api.v1.auth["change-password"].$put({
      json: { currentPassword, newPassword },
    });

    if (res.ok) {
      toast.success(t("Password changed!", "পাসওয়ার্ড পরিবর্তন হয়েছে!"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = (await res.json()) as { error: string };
      toast.error(
        data.error ??
          t("Failed to change password.", "পাসওয়ার্ড পরিবর্তন করা যায়নি।"),
      );
    }

    setLoading(false);
  }

  const infoRows = [
    {
      icon: Store,
      label: t("Shop Name", "দোকানের নাম"),
      value: shopInfo?.shopName,
    },
    { icon: User, label: t("Owner", "মালিক"), value: shopInfo?.ownerName },
    { icon: Phone, label: t("Phone", "ফোন"), value: shopInfo?.phone },
    { icon: MapPin, label: t("Address", "ঠিকানা"), value: shopInfo?.address },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Header with shop avatar */}
      <div className="flex items-center gap-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white shadow-sm"
          style={{ backgroundColor: CLAY }}
        >
          {(shopInfo?.shopName ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {shopInfo?.shopName ?? "—"}
          </h1>
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">
            {shopInfo?.ownerName ?? "—"}
          </p>
        </div>
      </div>

      {/* Shop info */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
        <div className="border-b border-stone-100 dark:border-stone-800 px-5 py-3.5">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            {t("Shop Info", "দোকানের তথ্য")}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t("Your shop details.", "আপনার দোকানের বিবরণ।")}
          </p>
        </div>
        <dl className="divide-y divide-stone-100 dark:divide-stone-800">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <Icon className="h-4 w-4 shrink-0 text-stone-400" />
              <dt className="w-20 shrink-0 text-xs font-medium text-stone-500 dark:text-stone-400 sm:w-24">
                {label}
              </dt>
              <dd className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-stone-900 dark:text-stone-100">
                {value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Change password */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
        <div className="border-b border-stone-100 dark:border-stone-800 px-5 py-3.5">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            {t("Change Password", "পাসওয়ার্ড পরিবর্তন")}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t(
              "Update your account password.",
              "আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন।",
            )}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="currentPassword"
              className="text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              {t("Current Password", "বর্তমান পাসওয়ার্ড")}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="newPassword"
              className="text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              {t("New Password", "নতুন পাসওয়ার্ড")}
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              {t("Confirm New Password", "নতুন পাসওয়ার্ড নিশ্চিত করুন")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 font-semibold text-white shadow-md shadow-amber-900/15 transition-all hover:brightness-105 active:scale-[0.99]"
            style={{ backgroundColor: CLAY }}
          >
            {loading
              ? t("Saving...", "সংরক্ষণ হচ্ছে...")
              : t("Change Password", "পাসওয়ার্ড পরিবর্তন")}
          </Button>
        </form>
      </div>
    </div>
  );
}
