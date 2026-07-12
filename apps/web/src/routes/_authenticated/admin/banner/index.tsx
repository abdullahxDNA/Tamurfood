import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/banner/")({
  component: BannerAdmin,
});

interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  tagline: string | null;
  imageUrl: string | null;
  enabled: boolean;
  updatedAt: string;
}

async function fetchBanner(): Promise<Banner | null> {
  const res = await api.api.v1.banner.$get();
  if (!res.ok) throw new Error("Failed to load banner");
  return res.json() as Promise<Banner | null>;
}

function BannerAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["banner"],
    queryFn: fetchBanner,
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate the form once the banner loads.
  useEffect(() => {
    if (data) {
      setTitle(data.title ?? "");
      setSubtitle(data.subtitle ?? "");
      setTagline(data.tagline ?? "");
      setImageUrl(data.imageUrl ?? "");
      setEnabled(data.enabled);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.v1.banner.$put({
        json: {
          title: title || null,
          subtitle: subtitle || null,
          tagline: tagline || null,
          imageUrl: imageUrl || null,
          enabled,
        },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner"] });
      toast.success("Banner saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/menu/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      const { url } = (await res.json()) as { url: string };
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hero Banner</h1>
        <p className="text-sm text-muted-foreground">
          The promo banner shown at the top of the shop menu.
        </p>
      </div>

      {/* Live preview */}
      <div>
        <Label className="mb-2 block">Preview</Label>
        <div
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-8 text-white"
          style={
            imageUrl
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.15)), url(${imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {subtitle && (
            <p className="text-xs font-medium uppercase tracking-wide opacity-90">
              {subtitle}
            </p>
          )}
          <h2 className="mt-1 text-2xl font-bold leading-tight">
            {title || "Your banner title"}
          </h2>
          {tagline && <p className="mt-1 text-sm opacity-90">{tagline}</p>}
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="enabled">Show banner</Label>
            <p className="text-xs text-muted-foreground">
              Turn off to hide the hero on the shop menu.
            </p>
          </div>
          <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="subtitle">Subtitle (small label)</Label>
          <Input
            id="subtitle"
            value={subtitle}
            maxLength={60}
            placeholder="Today's special"
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            maxLength={100}
            placeholder="Fresh bakery items, baked daily"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={tagline}
            maxLength={150}
            placeholder="Order before 10 AM for same-day delivery"
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>Background image (optional)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? "Uploading…"
                : imageUrl
                  ? "Replace image"
                  : "Upload image"}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setImageUrl("")}
              >
                Remove
              </Button>
            )}
          </div>
          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save banner"}
        </Button>
      </form>
    </div>
  );
}
