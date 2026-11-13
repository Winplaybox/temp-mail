export function msLeft(expiresAt: string, now: number): number {
  return Math.max(0, new Date(expiresAt).getTime() - now);
}

export function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function relativeTime(iso: string, now: number, lang: "en" | "hi"): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { numeric: "auto" });
  if (diff < 45) return rtf.format(-diff, "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function senderLabel(name: string | null, address: string | null): string {
  return name?.trim() || address || "Unknown sender";
}

export function initials(label: string): string {
  const clean = label.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Build a safe srcdoc for the reader iframe. Scripts never run; remote images only when allowed. */
export function emailDocument(html: string, allowImages: boolean, dark: boolean): string {
  const img = allowImages ? "img-src data: cid: https: http:;" : "img-src data: cid:;";
  const csp = `default-src 'none'; ${img} style-src 'unsafe-inline'; font-src data:; media-src 'none';`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:${dark ? "#f4f7fb" : "#ffffff"};}
  body{padding:20px;font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d2733;word-break:break-word;}
  img{max-width:100%;height:auto;}
  table{max-width:100%;}
  a{color:#1e4fd8;}
</style></head><body>${html}</body></html>`;
}

export function countRemoteImages(html: string): number {
  return (html.match(/<img[^>]+src=["']?https?:/gi) ?? []).length;
}
