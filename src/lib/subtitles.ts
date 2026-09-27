import type { Cue } from "./assist.functions";
import { BRAND_SLUG } from "./brand";

const KEY = (id: string) => `${BRAND_SLUG}:subs:${id}`;

export function loadCues(id: string): Cue[] | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Cue[]) : null;
  } catch {
    return null;
  }
}

export function saveCues(id: string, cues: Cue[]) {
  localStorage.setItem(KEY(id), JSON.stringify(cues));
}

function ts(s: number) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
}

export function toSrt(cues: Cue[]) {
  return cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n");
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
