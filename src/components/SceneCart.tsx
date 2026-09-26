import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Play, ShoppingBasket, Trash2 } from "lucide-react";

export type Priority = "high" | "normal" | "low";
export type CartItem<S = any> = {
  id: string;
  scene: string;
  priority: Priority;
  format: string;
  resolution: string;
  duration: number;
  shots: S[];
  createdAt: number;
};

const RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const LABEL: Record<Priority, string> = { high: "Haute", normal: "Normale", low: "Basse" };

/** Priority first, then manual order within the list. */
export function sortCart<T extends CartItem>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RANK[a.item.priority] - RANK[b.item.priority] || a.index - b.index)
    .map((x) => x.item);
}

export function useSceneCart(userId?: string) {
  const key = userId ? `avira-cart-${userId}` : null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return setItems([]);
    try {
      setItems(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setItems([]);
    }
  }, [key]);

  const persist = (next: CartItem[]) => {
    setItems(next);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setWarning(null);
    } catch {
      setWarning("Panier trop lourd pour être conservé après rechargement (images de référence). Il reste actif dans cet onglet.");
    }
  };

  return {
    items: sortCart(items),
    warning,
    add: (item: CartItem) => persist([...items, item]),
    remove: (id: string) => persist(items.filter((i) => i.id !== id)),
    clear: () => persist([]),
    setPriority: (id: string, priority: Priority) =>
      persist(items.map((i) => (i.id === id ? { ...i, priority } : i))),
    move: (id: string, dir: -1 | 1) => {
      const sorted = sortCart(items);
      const idx = sorted.findIndex((i) => i.id === id);
      const other = sorted[idx + dir];
      if (!other || other.priority !== sorted[idx]!.priority) return;
      [sorted[idx], sorted[idx + dir]] = [other, sorted[idx]!];
      persist(sorted);
    },
  };
}

export function SceneCartPanel({
  cart,
  busy,
  onProduce,
}: {
  cart: ReturnType<typeof useSceneCart>;
  busy: boolean;
  onProduce: () => void;
}) {
  const totalShots = cart.items.reduce((s, i) => s + i.shots.length, 0);
  const totalSeconds = cart.items.reduce((s, i) => s + i.duration, 0);
  return (
    <section className="mt-8 rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl leading-tight">
            <ShoppingBasket className="size-5" /> Panier de scènes
          </h2>
          <p className="text-sm text-muted-foreground">
            {cart.items.length
              ? `${cart.items.length} scène(s) · ${totalShots} plan(s) · ${totalSeconds} s — produites par ordre de priorité.`
              : "Ajoutez des scènes depuis le formulaire, puis produisez-les d’un coup."}
          </p>
        </div>
        {cart.items.length > 0 && (
          <div className="flex gap-2">
            <button onClick={cart.clear} disabled={busy} className="rounded-full px-4 py-2 text-sm ring-1 ring-white/10 hover:ring-destructive disabled:opacity-50">
              Vider
            </button>
            <button onClick={onProduce} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Play className="size-4" /> {busy ? "Envoi…" : "Tout produire"}
            </button>
          </div>
        )}
      </div>
      {cart.warning && <p className="mt-3 text-xs text-destructive">{cart.warning}</p>}
      {cart.items.length > 0 && (
        <ol className="mt-4 space-y-2">
          {cart.items.map((item, index) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-[10px] bg-background p-3 ring-1 ring-white/5">
              <span className="w-6 font-mono text-xs text-muted-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{item.scene}</p>
                <p className="font-mono text-[10px] uppercase text-muted-foreground">
                  {item.format} · {item.resolution} · {item.duration}s · {item.shots.length} plan(s)
                </p>
              </div>
              <div className="flex rounded-full bg-paper p-0.5 ring-1 ring-white/5" role="group" aria-label="Priorité">
                {(["high", "normal", "low"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    aria-pressed={item.priority === p}
                    onClick={() => cart.setPriority(item.id, p)}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${item.priority === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {LABEL[p]}
                  </button>
                ))}
              </div>
              <div className="flex">
                <button aria-label="Monter" onClick={() => cart.move(item.id, -1)} className="p-1.5 text-muted-foreground hover:text-foreground"><ArrowUp className="size-4" /></button>
                <button aria-label="Descendre" onClick={() => cart.move(item.id, 1)} className="p-1.5 text-muted-foreground hover:text-foreground"><ArrowDown className="size-4" /></button>
                <button aria-label="Retirer" onClick={() => cart.remove(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
