"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPhoto } from "@/app/actions";
import { TYPE_META, type ContactType } from "@/lib/types";

/** Shrink to a 512px square-ish JPEG so storage stays small and loads fast. */
async function shrink(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const max = 512;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? blob), "image/jpeg", 0.88));
}

/**
 * Avatar that accepts a photo by: paste (Cmd/Ctrl+V while hovered or focused), drag and drop
 * (a file, or an image dragged from another tab), the Paste button (works on iPhone), or tap to choose.
 * `pageLevel` also listens for paste anywhere on the page (single-contact pages).
 */
export default function PhotoDrop({
  id, name, photo, type, size = 96, pageLevel = false,
}: { id: string; name: string; photo: string | null; type: ContactType | null; size?: number; pageLevel?: boolean }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(photo);
  const [hover, setHover] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const hovered = useRef(false);
  const ring = type ? TYPE_META[type].hex : "rgb(var(--line))";

  function save(blobOrUrl: Blob | string) {
    setMsg("");
    start(async () => {
      try {
        const fd = new FormData();
        if (typeof blobOrUrl === "string") {
          fd.set("url", blobOrUrl);
        } else {
          const small = await shrink(blobOrUrl);
          setPreview(URL.createObjectURL(small));
          fd.set("file", new File([small], "photo.jpg", { type: "image/jpeg" }));
        }
        const r = await setPhoto(id, fd);
        if (r?.error) setMsg(r.error);
        else router.refresh();
      } catch {
        setMsg("Couldn't read that image. Try Copy Image, then paste.");
      }
    });
  }

  function fromClipboardData(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    const file = Array.from(dt.files).find((f) => f.type.startsWith("image/"))
      ?? Array.from(dt.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
    if (file) { save(file); return true; }
    const html = dt.getData("text/html");
    const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
    const url = src ?? dt.getData("text/uri-list") ?? dt.getData("text/plain");
    if (url && /^https?:\/\/\S+$/.test(url.trim())) { save(url.trim()); return true; }
    return false;
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!pageLevel && !hovered.current) return;
      if (fromClipboardData(e.clipboardData)) e.preventDefault();
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLevel]);

  async function pasteButton() {
    setMsg("");
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find((x) => x.startsWith("image/"));
        if (t) return save(await it.getType(t));
      }
      const text = await navigator.clipboard.readText();
      if (/^https?:\/\//.test(text.trim())) return save(text.trim());
      setMsg("No image on the clipboard. Copy the photo first.");
    } catch {
      setMsg("Clipboard blocked. Use Cmd+V or tap the photo to choose a file.");
    }
  }

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        tabIndex={0}
        aria-label={`Photo for ${name}. Paste, drop, or click to choose an image.`}
        title="Paste (Cmd+V), drop, or click to choose a photo"
        onClick={() => fileRef.current?.click()}
        onMouseEnter={() => { hovered.current = true; setHover(true); }}
        onMouseLeave={() => { hovered.current = false; setHover(false); }}
        onFocus={() => { hovered.current = true; }}
        onBlur={() => { hovered.current = false; }}
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => { e.preventDefault(); setHover(false); if (!fromClipboardData(e.dataTransfer)) setMsg("That wasn't an image."); }}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        style={{ width: size, height: size, padding: size >= 96 ? 4 : 3, background: ring }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-card bg-card">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display font-semibold text-white" style={{ background: type ? ring : "rgb(var(--muted))", fontSize: size * 0.34 }}>
              {initials}
            </div>
          )}
          <div className={`absolute inset-0 flex items-center justify-center bg-black/55 text-center text-[11px] font-medium leading-tight text-white transition ${hover || pending ? "opacity-100" : "opacity-0"}`}>
            {pending ? "Saving..." : <>Paste or<br />drop photo</>}
          </div>
        </div>
      </button>
      <button type="button" onClick={pasteButton} disabled={pending} className="text-[11px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
        {preview ? "Paste new photo" : "Paste photo"}
      </button>
      {msg && <p className="max-w-[180px] text-center text-[11px] text-red-600">{msg}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && save(e.target.files[0])} />
    </div>
  );
}
