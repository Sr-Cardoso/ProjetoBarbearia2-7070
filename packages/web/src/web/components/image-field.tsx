import { useRef, useState } from "react";
import { ImageUp, Link2, Loader2, X } from "lucide-react";
import { client } from "../lib/api";

/**
 * Campo de imagem do painel: upload direto do computador (presign + PUT no
 * storage) ou colagem de uma URL.
 */
export function ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { url, publicUrl } = await client.upload.presign({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      });
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!res.ok) throw new Error(`upload falhou (${res.status})`);
      onChange(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="eyebrow text-[9px] text-muted-foreground">{label}</span>
      <div className="mt-2 flex gap-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden border border-border bg-surface">
          {value ? (
            <img src={value} alt={label} className="size-full object-cover" />
          ) : (
            <ImageUp className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 border border-border bg-surface px-3">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="/images/foto.jpg ou https://…"
              className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Limpar"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors hover:border-primary disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}
              Enviar arquivo
            </button>
            {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
