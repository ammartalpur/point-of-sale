"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DealCommand, DealData } from "@/app/lib/deal-management";
import type { MenuProduct } from "@/app/lib/menu-management";
import ProductImageField from "../menu/ProductImageField";
import { buttonStyle, FormError, inputStyle, Modal, primaryStyle } from "../menu/MenuControls";
import { mutateDeal } from "./actions";
import OtaqBrand from "@/app/components/OtaqBrand";

type Editor = { kind: "deal"; deal?: DealData } | { kind: "confirm"; title: string; description: string; command: DealCommand };

function useDealSave(onSuccess: (message: string) => void) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(command: unknown) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await mutateDeal(command);
      if (result.success) { router.refresh(); onSuccess(result.message); }
      else setError(result.error);
    } catch { setError("The update could not be confirmed. Refresh deals before trying again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { busy, error, save };
}

export default function DealManager({ deals, products }: { deals: DealData[]; products: MenuProduct[] }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [view, setView] = useState("active");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const visible = deals.filter((deal) => deal.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (view === "all" || (view === "archived" ? deal.isArchived : !deal.isArchived)));
  const saved = (notice: string) => { setMessage(notice); setEditor(null); };
  const confirm = (title: string, description: string, command: DealCommand) => setEditor({ kind: "confirm", title, description, command });
  return <main className="min-h-screen bg-[#17110d] px-4 py-8 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/admin/dashboard" className="text-sm font-medium text-orange-400 hover:text-orange-300">← Dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Combos & deals</h1>
          <p className="mt-1 text-sm text-slate-500">Bundle products at one fixed price. Component stock is deducted when the deal is sold.</p></div>
        <div className="flex flex-wrap items-center gap-4"><OtaqBrand /><button className={primaryStyle} onClick={() => setEditor({ kind: "deal" })} disabled={products.length === 0}>+ Create deal</button></div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Total deals", deals.length], ["Active", deals.filter((d) => !d.isArchived && d.isActive).length],
          ["Available now", deals.filter((d) => d.available).length], ["Archived", deals.filter((d) => d.isArchived).length]].map(([label, count]) =>
          <div key={label} className="rounded-xl border border-white/7 bg-[#211912] p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-white">{count}</p></div>)}
      </div>
      {message && <div role="status" className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>✕</button></div>}
      <section className="overflow-hidden rounded-xl border border-white/7 bg-[#211912]">
        <div className="flex flex-wrap items-end gap-3 border-b border-white/7 p-4">
          <label className="min-w-48 flex-1 text-xs font-medium text-slate-500">Search deals<input value={search} onChange={(e) => setSearch(e.target.value)} className={inputStyle} placeholder="Deal name…" /></label>
          <label className="text-xs font-medium text-slate-500">Show<select value={view} onChange={(e) => setView(e.target.value)} className={inputStyle}><option value="active">Current deals</option><option value="archived">Archived</option><option value="all">All deals</option></select></label>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((deal) => {
          const regular = deal.items.reduce((sum, item) => sum + Number(item.product.basePrice) * item.quantity, 0);
          const status = deal.isArchived ? "Archived" : !deal.isActive ? "Paused" : deal.available ? "Available" : "Unavailable from stock/catalog";
          return <article key={deal.id} aria-label={deal.name} className="overflow-hidden rounded-xl border border-white/8 bg-[#2a1f17]">
            {deal.imageUrl ? <Image src={deal.imageUrl} alt={deal.name} width={640} height={240} className="h-36 w-full bg-white/5 object-cover" /> : <div className="flex h-36 items-center justify-center bg-linear-to-br from-teal-500/10 to-orange-500/10 text-sm text-slate-500">No deal image</div>}
            <div className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-white">{deal.name}</h2><p className="text-xl font-bold text-orange-400">Rs {deal.price}</p><p className="text-xs text-slate-500">Regular value Rs {regular.toFixed(2)}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deal.available ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}>{status}</span></div>
              <ul className="space-y-1 text-sm text-slate-400">{deal.items.map((item) => <li key={item.id}>{item.quantity} × {item.product.name}</li>)}</ul>
              <p className="text-xs text-slate-500">Up to {deal.maxQuantity} combo{deal.maxQuantity === 1 ? "" : "s"} from current stock · {deal.salesCount} recorded sale{deal.salesCount === 1 ? "" : "s"}</p>
              <div className="flex flex-wrap gap-2"><button className={buttonStyle} onClick={() => setEditor({ kind: "deal", deal })}>Edit</button>
                {!deal.isArchived && <button className={buttonStyle} onClick={() => confirm(deal.isActive ? "Pause deal" : "Enable deal", deal.isActive ? `Pause “${deal.name}”? It will disappear from checkout.` : `Enable “${deal.name}”? It will appear when every component is available and in stock.`, { type: "setDealActive", id: deal.id, isActive: !deal.isActive })}>{deal.isActive ? "Pause" : "Enable"}</button>}
                <button className={buttonStyle} onClick={() => confirm(deal.isArchived ? "Restore deal" : "Archive deal", deal.isArchived ? `Restore “${deal.name}”? Its active setting stays unchanged.` : `Archive “${deal.name}”? It will be removed from checkout and sales history will remain.`, { type: deal.isArchived ? "restoreDeal" : "archiveDeal", id: deal.id })}>{deal.isArchived ? "Restore" : "Archive"}</button>
                <button className={`${buttonStyle} text-rose-400`} onClick={() => confirm("Delete deal", `Delete “${deal.name}”? Deals with sales history are archived instead.`, { type: "deleteDeal", id: deal.id })}>Delete</button></div>
            </div></article>;
        })}</div>
        {visible.length === 0 && <p className="p-12 text-center text-sm text-slate-500">No deals match this view.</p>}
      </section>
    </div>
    {editor?.kind === "deal" && <DealEditor deal={editor.deal} products={products} onClose={() => setEditor(null)} onSaved={saved} />}
    {editor?.kind === "confirm" && <ConfirmEditor {...editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </main>;
}

function DealEditor({ deal, products, onClose, onSaved }: { deal?: DealData; products: MenuProduct[]; onClose: () => void; onSaved: (message: string) => void }) {
  const initial = deal?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) ?? [{ productId: "", quantity: 1 }, { productId: "", quantity: 1 }];
  const [items, setItems] = useState(initial);
  const [imageUrl, setImageUrl] = useState(deal?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const { busy, error, save } = useDealSave(onSaved);
  const locked = busy || uploading;
  const selected = new Set(items.map((item) => item.productId).filter(Boolean));
  return <Modal title={deal ? "Edit deal" : "Create deal"} onClose={() => { if (!locked) onClose(); }}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (locked) return; const form = new FormData(event.currentTarget); void save({ type: "saveDeal", id: deal?.id, name: form.get("name"), price: form.get("price"), imageUrl, isActive: form.get("active") === "on", items: items.filter((item) => item.productId) }); }}>
      <fieldset disabled={locked} className="space-y-4">
        <label className="block text-sm font-medium">Deal name<input name="name" required maxLength={120} defaultValue={deal?.name ?? ""} className={inputStyle} autoFocus /></label>
        <label className="block text-sm font-medium">Fixed price (Rs)<input name="price" required type="number" min="0.01" max="99999999.99" step="0.01" defaultValue={deal?.price ?? ""} className={inputStyle} /></label>
        <div><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Products in this deal</span><button type="button" className={buttonStyle} onClick={() => setItems((current) => [...current, { productId: "", quantity: 1 }])} disabled={items.length >= 50}>+ Add product</button></div>
          <div className="space-y-2">{items.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_auto] gap-2">
            <select aria-label={`Deal product ${index + 1}`} required value={item.productId} className={inputStyle} onChange={(e) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, productId: e.target.value } : row))}>
              <option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id} disabled={selected.has(product.id) && item.productId !== product.id}>{product.name} · Rs {product.basePrice}</option>)}</select>
            <input aria-label={`Quantity for product ${index + 1}`} type="number" min="1" max="10000" step="1" required value={item.quantity} className={inputStyle} onChange={(e) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(e.target.value) } : row))} />
            <button type="button" className={`${buttonStyle} mt-1 text-red-600`} aria-label={`Remove product ${index + 1}`} onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>✕</button>
          </div>)}</div><p className="mt-2 text-xs text-slate-500">A deal needs at least two total item units. Stock is tracked on each component product.</p></div>
        <label className="flex items-center gap-3 text-sm"><input name="active" type="checkbox" defaultChecked={deal?.isActive ?? true} className="h-4 w-4 accent-amber-600" />Active at checkout</label>
        <ProductImageField value={imageUrl} onChange={setImageUrl} onUploadingChange={setUploading} />
      </fieldset>
      <FormError error={error} /><div className="flex justify-end gap-2"><button type="button" disabled={locked} className={buttonStyle} onClick={onClose}>Cancel</button><button disabled={locked} className={primaryStyle}>{uploading ? "Uploading…" : busy ? "Saving…" : "Save deal"}</button></div>
    </form>
  </Modal>;
}

function ConfirmEditor({ title, description, command, onClose, onSaved }: { title: string; description: string; command: DealCommand; onClose: () => void; onSaved: (message: string) => void }) {
  const { busy, error, save } = useDealSave(onSaved);
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}><div className="space-y-4"><p className="text-sm leading-relaxed text-slate-400">{description}</p><FormError error={error} /><div className="flex justify-end gap-2"><button disabled={busy} className={buttonStyle} onClick={onClose}>Cancel</button><button disabled={busy} className={primaryStyle} onClick={() => void save(command)}>{busy ? "Saving…" : "Confirm"}</button></div></div></Modal>;
}
