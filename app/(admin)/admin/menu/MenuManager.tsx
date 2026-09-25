"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { MenuCategory, MenuCommand, MenuProduct } from "@/app/lib/menu-management";
import ProductEditor from "./ProductEditor";
import { buttonStyle, FormError, inputStyle, Modal, primaryStyle, useMenuSave } from "./MenuControls";
import OtaqBrand from "@/app/components/OtaqBrand";

type Editor = { kind: "product"; product?: MenuProduct } | { kind: "category"; category?: MenuCategory } |
  { kind: "stock"; product: MenuProduct } | { kind: "confirm"; title: string; description: string; command: MenuCommand };

export default function MenuManager({ categories, products }: { categories: MenuCategory[]; products: MenuProduct[] }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [view, setView] = useState("active");
  const [message, setMessage] = useState("");
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const selectedCategory = categoryMap.has(categoryFilter) ? categoryFilter : "";
  const archived = (product: MenuProduct) => product.isArchived || Boolean(categoryMap.get(product.categoryId)?.isArchived);
  const visibleProducts = products.filter((product) => {
    const matches = `${product.name} ${categoryMap.get(product.categoryId)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase().trim());
    return matches && (!selectedCategory || product.categoryId === selectedCategory) &&
      (view === "all" || (view === "archived" ? archived(product) : !archived(product)));
  });
  const activeProducts = products.filter((product) => !archived(product));
  function saved(notice: string) { setMessage(notice); setEditor(null); }
  function confirm(title: string, description: string, command: MenuCommand) { setEditor({ kind: "confirm", title, description, command }); }

  return <main className="min-h-screen bg-[#17110d] px-4 py-8 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/admin/dashboard" className="text-sm font-medium text-orange-400 hover:text-orange-300">← Dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Menu & inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your catalog, preparation settings and what is available to sell.</p></div>
        <div className="flex flex-wrap items-center gap-4"><OtaqBrand /><button className={primaryStyle} onClick={() => setEditor({ kind: "product" })} disabled={!categories.some((category) => !category.isArchived)}>+ Add product</button></div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Active products", activeProducts.length], ["Categories", categories.filter((category) => !category.isArchived).length],
          ["Sold out", activeProducts.filter((product) => product.stock === 0).length], ["Unavailable", activeProducts.filter((product) => !product.isAvailable).length]].map(([label, count]) =>
          <div key={label} className="rounded-xl border border-white/7 bg-[#211912] p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-white">{count}</p></div>)}
      </div>
      {message && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>✕</button></div>}
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-white/7 bg-[#211912] p-4">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-white">Categories</h2><button onClick={() => setEditor({ kind: "category" })} className="text-sm font-semibold text-orange-400">+ Add category</button></div>
          <button onClick={() => setCategoryFilter("")} aria-pressed={!selectedCategory} className={`mb-3 w-full rounded-lg p-3 text-left text-sm font-semibold ${!selectedCategory ? "bg-orange-400/15 text-orange-300" : "bg-white/3 text-slate-400"}`}>All categories</button>
          <div className="space-y-3">{categories.map((category) => <div key={category.id} className={`rounded-lg border p-3 ${categoryFilter === category.id ? "border-orange-400/40 bg-orange-400/10" : "border-white/8 bg-white/2"}`}>
            <button className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold" aria-pressed={selectedCategory === category.id} onClick={() => { setCategoryFilter(category.id); setView(category.isArchived ? "archived" : "active"); }}>
              <span>{category.name}</span><span className="text-xs text-slate-500">{category._count.products}</span></button>
            <p className="mt-1 text-xs text-slate-500">{category.isArchived ? "Archived · " : ""}{category.requiresPreparation ? "Kitchen preparation" : "Ready to serve"}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs font-medium">
              <button className="text-blue-700" aria-label={`Edit category ${category.name}`} onClick={() => setEditor({ kind: "category", category })}>Edit</button>
              <button className="text-slate-600" aria-label={`${category.isArchived ? "Restore" : "Archive"} category ${category.name}`} onClick={() => confirm(category.isArchived ? "Restore category" : "Archive category",
                category.isArchived ? `Restore “${category.name}”? Products retain their own archive and availability settings.` : `Archive “${category.name}”? Its products and deals containing them will be unavailable at checkout. History is preserved.`,
                { type: category.isArchived ? "restoreCategory" : "archiveCategory", id: category.id })}>{category.isArchived ? "Restore" : "Archive"}</button>
              <button className="text-red-600" aria-label={`Delete category ${category.name}`} onClick={() => confirm("Delete category", `Delete “${category.name}”? Only empty categories can be permanently deleted. Move its products or archive the category otherwise.`, { type: "deleteCategory", id: category.id })}>Delete</button>
            </div>
          </div>)}</div>
          {categories.length === 0 && <p className="py-6 text-sm text-slate-500">Add your first category to start building the menu.</p>}
        </aside>
        <section className="overflow-hidden rounded-xl border border-white/7 bg-[#211912]">
          <div className="flex flex-wrap items-end gap-3 border-b border-white/7 p-4">
            <label className="min-w-40 flex-1 text-xs font-medium text-slate-500">Search products<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or category…" className={inputStyle} /></label>
            <label className="text-xs font-medium text-slate-500">Show<select value={view} onChange={(event) => setView(event.target.value)} className={inputStyle}><option value="active">Active catalog</option><option value="archived">Archived</option><option value="all">All products</option></select></label>
          </div>
          <div className="divide-y divide-white/5">{visibleProducts.map((product) => {
            const category = categoryMap.get(product.categoryId);
            const status = archived(product) ? "Archived" : !product.isAvailable ? "Unavailable" : product.stock === 0 ? "Sold out" : "Available";
            return <article key={product.id} aria-label={product.name} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="h-16 w-16 rounded-xl bg-white/5 object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs text-slate-500">No image</div>}
              <div className="min-w-32 flex-1"><h3 className="font-semibold">{product.name}</h3><p className="text-sm text-slate-500">{category?.name} · Rs {product.basePrice}</p>
                <p className="mt-1 text-xs text-slate-500">{product.stock} in stock · {(product.requiresPreparation ?? category?.requiresPreparation) ? "Kitchen preparation" : "Ready to serve"}{category?.isArchived ? " · Category archived" : ""}</p></div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Available" ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}>{status}</span>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonStyle} onClick={() => setEditor({ kind: "product", product })}>Edit</button>
                  <button className={buttonStyle} onClick={() => setEditor({ kind: "stock", product })}>Adjust stock</button>
                  {!archived(product) && <button className={buttonStyle} onClick={() => confirm(product.isAvailable ? "Mark unavailable" : "Enable product", product.isAvailable ? `Stop selling “${product.name}” without changing its stock?` : `Enable “${product.name}”? It will appear at checkout when stock is above zero.`, { type: "setAvailability", id: product.id, isAvailable: !product.isAvailable })}>{product.isAvailable ? "Mark unavailable" : "Enable"}</button>}
                  <button className={buttonStyle} onClick={() => confirm(product.isArchived ? "Restore product" : "Archive product", product.isArchived ? `Restore “${product.name}”? Its category must be active.` : `Archive “${product.name}”? It will be hidden from checkout; history and stock stay intact.`, { type: product.isArchived ? "restoreProduct" : "archiveProduct", id: product.id })}>{product.isArchived ? "Restore" : "Archive"}</button>
                  <button className={`${buttonStyle} text-red-600`} onClick={() => confirm("Delete product", `Delete “${product.name}”? Unused products are permanently deleted. Products linked to sales or deals are archived instead.`, { type: "deleteProduct", id: product.id })}>Delete</button>
                </div>
              </div>
            </article>;
          })}</div>
          {visibleProducts.length === 0 && <p className="p-12 text-center text-sm text-slate-500">No products match this view. Try another category or filter, or add a product.</p>}
          <p className="border-t border-white/5 px-5 py-3 text-xs text-slate-500">{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"} shown · Stock and availability are managed independently.</p>
        </section>
      </div>
    </div>
    {editor?.kind === "product" && <ProductEditor product={editor.product} categories={categories} onClose={() => setEditor(null)} onSaved={saved} />}
    {editor?.kind === "category" && <CategoryEditor category={editor.category} onClose={() => setEditor(null)} onSaved={saved} />}
    {editor?.kind === "stock" && <StockEditor product={editor.product} onClose={() => setEditor(null)} onSaved={saved} />}
    {editor?.kind === "confirm" && <ConfirmEditor {...editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </main>;
}

function CategoryEditor({ category, onClose, onSaved }: { category?: MenuCategory; onClose: () => void; onSaved: (message: string) => void }) {
  const { busy, error, save } = useMenuSave(onSaved);
  return <Modal title={category ? "Edit category" : "Add category"} onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ type: "saveCategory", id: category?.id, name: form.get("name"), requiresPreparation: form.get("preparation") === "on" }); }}>
      <fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-medium">Category name<input name="name" required maxLength={80} defaultValue={category?.name ?? ""} className={inputStyle} autoFocus /></label>
        <label className="flex items-center gap-3 text-sm"><input name="preparation" type="checkbox" defaultChecked={category?.requiresPreparation ?? true} className="h-4 w-4 accent-amber-600" />Requires kitchen preparation</label>
        <p className="text-xs text-slate-500">Products inherit this setting unless overridden. Existing orders keep their original preparation settings.</p></fieldset>
      <FormError error={error} /><div className="flex justify-end gap-2"><button type="button" disabled={busy} className={buttonStyle} onClick={onClose}>Cancel</button><button disabled={busy} className={primaryStyle}>{busy ? "Saving…" : "Save category"}</button></div>
    </form>
  </Modal>;
}

function StockEditor({ product, onClose, onSaved }: { product: MenuProduct; onClose: () => void; onSaved: (message: string) => void }) {
  const { busy, error, save } = useMenuSave(onSaved);
  return <Modal title={`Adjust stock: ${product.name}`} onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ type: "setStock", id: product.id, stock: Number(form.get("stock")), expectedStock: product.stock }); }}>
      <p className="text-sm text-slate-500">Current count: {product.stock}. Enter the total stock on hand. Availability stays unchanged.</p>
      <label className="block text-sm font-medium">New stock count<input name="stock" type="number" required min="0" max="2147483647" step="1" defaultValue={product.stock} disabled={busy} className={inputStyle} autoFocus /></label>
      <FormError error={error} /><div className="flex justify-end gap-2"><button type="button" disabled={busy} className={buttonStyle} onClick={onClose}>Cancel</button><button disabled={busy} className={primaryStyle}>{busy ? "Saving…" : "Save stock"}</button></div>
    </form>
  </Modal>;
}

function ConfirmEditor({ title, description, command, onClose, onSaved }: { title: string; description: string; command: MenuCommand; onClose: () => void; onSaved: (message: string) => void }) {
  const { busy, error, save } = useMenuSave(onSaved);
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}><div className="space-y-4">
    <p className="text-sm leading-relaxed text-slate-400">{description}</p><FormError error={error} />
    <div className="flex justify-end gap-2"><button disabled={busy} className={buttonStyle} onClick={onClose}>Cancel</button><button disabled={busy} className={primaryStyle} onClick={() => void save(command)}>{busy ? "Saving…" : "Confirm"}</button></div>
  </div></Modal>;
}
