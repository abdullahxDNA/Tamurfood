import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/shop/profile/")({
  component: ShopProfilePage,
});

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

  return (
    <div className="max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Shop Info", "দোকানের তথ্য")}</CardTitle>
          <CardDescription>
            {t("Your shop details.", "আপনার দোকানের বিবরণ।")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("Shop Name", "দোকানের নাম")}
            </p>
            <p className="text-sm font-medium">{shopInfo?.shopName ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("Owner", "মালিক")}
            </p>
            <p className="text-sm font-medium">{shopInfo?.ownerName ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("Phone", "ফোন")}</p>
            <p className="text-sm font-medium">{shopInfo?.phone ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("Address", "ঠিকানা")}
            </p>
            <p className="text-sm font-medium">{shopInfo?.address ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Change Password", "পাসওয়ার্ড পরিবর্তন")}</CardTitle>
          <CardDescription>
            {t(
              "Update your account password.",
              "আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন।",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t("Current Password", "বর্তমান পাসওয়ার্ড")}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {t("New Password", "নতুন পাসওয়ার্ড")}
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("Confirm New Password", "নতুন পাসওয়ার্ড নিশ্চিত করুন")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? t("Saving...", "সংরক্ষণ হচ্ছে...")
                : t("Change Password", "পাসওয়ার্ড পরিবর্তন")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
