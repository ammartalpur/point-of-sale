"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buttonStyle, inputStyle } from "./MenuControls";

export default function ProductImageField({ value, onChange, onUploadingChange }: {
  value: string; onChange: (value: string) => void; onUploadingChange: (uploading: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const configured = Boolean(cloudName && preset);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload(file: File) {
    if (!cloudName || !preset || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPG, PNG, WebP or AVIF image up to 8 MB.");
      return;
    }
    setError(""); setUploading(true); onUploadingChange(true);
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 60_000);
    try {
      const data = new FormData();
      data.set("file", file); data.set("upload_preset", preset);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: "POST", body: data, signal: request.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("secure_url" in result) ||
        typeof result.secure_url !== "string" || !result.secure_url.startsWith("https://res.cloudinary.com/")) {
        throw new Error("Upload failed");
      }
      onChange(result.secure_url);
    } catch { setError("Image upload failed or timed out. Try again, or paste a Cloudinary image URL."); }
    finally { clearTimeout(timeout); controller.current = null; setUploading(false); onUploadingChange(false); }
  }
  return <div className="space-y-3 rounded-xl border border-dashed border-white/15 bg-white/2 p-4">
    <div className="flex items-center gap-4">
      {value.startsWith("https://res.cloudinary.com/") ? <Image src={value} alt="Image preview" width={72} height={72} className="h-18 w-18 rounded-lg object-cover" /> :
        <div className="flex h-18 w-18 items-center justify-center rounded-lg bg-white/5 text-xs text-slate-500">No image</div>}
      <div className="flex flex-wrap gap-2">
        {value && <button type="button" disabled={uploading} className={buttonStyle} onClick={() => onChange("")}>Remove image</button>}
      </div>
    </div>
    {configured && <label className="block text-sm font-medium">Upload image
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-400/15 file:px-3 file:py-2 file:font-medium file:text-orange-300"
        onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} />
      <span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG, WebP or AVIF · up to 8 MB</span>
    </label>}
    {uploading && <p role="status" className="text-sm text-orange-400">Uploading image…</p>}
    <label className="block text-sm font-medium">Image URL (optional)
      <input type="url" disabled={uploading} value={value} onChange={(event) => onChange(event.target.value)} className={inputStyle} placeholder="https://res.cloudinary.com/…" maxLength={2000} />
    </label>
    {!configured && <p className="text-xs text-slate-500">Image upload is not configured. You can paste an existing Cloudinary image URL.</p>}
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
  </div>;
}
