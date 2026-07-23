"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-provider";
import type { AnimalImage } from "@/lib/supabase/types";

interface AnimalImageGalleryProps {
  animalId: string;
  canEdit: boolean;
}

/** Multiple-photo gallery per animal — separate from disease_records' single incident photo. */
export function AnimalImageGallery({ animalId, canEdit }: AnimalImageGalleryProps) {
  const { profile } = useAuth();
  const [images, setImages] = useState<AnimalImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function loadImages() {
    const { data } = await supabase
      .from("animal_images")
      .select("*")
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false });
    setImages(data ?? []);

    const entries = await Promise.all(
      (data ?? []).map(async (img) => {
        const { data: signed } = await supabase.storage
          .from("animal-images")
          .createSignedUrl(img.image_url, 3600);
        return [img.id, signed?.signedUrl ?? ""] as const;
      })
    );
    setUrls(Object.fromEntries(entries));
  }

  useEffect(() => {
    void loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId]);

  async function onUpload(file: File) {
    if (!profile?.farm_id) return;
    if (!navigator.onLine) {
      toast.warning("چون آفلاین هستید، عکس بارگذاری نشد. دوباره وقتی آنلاین شدید تلاش کنید.");
      return;
    }
    setUploading(true);
    const path = `${profile.farm_id}/${animalId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("animal-images").upload(path, file);
    if (uploadError) {
      setUploading(false);
      toast.error(`بارگذاری عکس ناموفق بود: ${uploadError.message}`);
      return;
    }
    const { error: insertError } = await supabase
      .from("animal_images")
      .insert({ farm_id: profile.farm_id, animal_id: animalId, image_url: path });
    setUploading(false);
    if (insertError) {
      toast.error(`ثبت عکس ناموفق بود: ${insertError.message}`);
      return;
    }
    toast.success("عکس اضافه شد");
    void loadImages();
  }

  async function onDelete(image: AnimalImage) {
    const { error: storageError } = await supabase.storage.from("animal-images").remove([image.image_url]);
    if (storageError) {
      toast.error(`حذف عکس ناموفق بود: ${storageError.message}`);
      return;
    }
    await supabase.from("animal_images").delete().eq("id", image.id);
    toast.success("عکس حذف شد");
    void loadImages();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {urls[img.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[img.id]} alt="" className="h-full w-full object-cover" />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onDelete(img)}
                className="absolute top-1 left-1 rounded-full bg-black/60 p-1"
                aria-label="حذف عکس"
              >
                <X className="size-3 text-white" />
              </button>
            )}
          </div>
        ))}

        {canEdit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-muted-foreground">
            <Camera className="size-6" />
            <span className="text-xs">{uploading ? "در حال آپلود…" : "افزودن عکس"}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {images.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">عکسی ثبت نشده است.</p>
      )}
    </div>
  );
}
