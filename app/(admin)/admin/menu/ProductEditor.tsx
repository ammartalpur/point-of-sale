"use client";

import { useState } from "react";
import type { MenuCategory, MenuProduct } from "@/app/lib/menu-management";
import ProductImageField from "./ProductImageField";
import { buttonStyle, FormError, inputStyle, Modal, primaryStyle, useMenuSave } from "./MenuControls";

export default function ProductEditor({ product, categories, onClose, onSaved }: {
  product?: MenuProduct; categories: MenuCategory[]; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const { busy: saving, error, save } = useMenuSave(onSaved);
  const busy = saving || uploading;
  const activeCategories = categories.filter((category) => !category.isArchived);
  const initialCategory = activeCategories.some((category) => category.id === product?.categoryId) ? product?.categoryId : "";
  return <Modal title={product ? "Edit product" : "Add product"} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (busy) return;
      const form = new FormData(event.currentTarget);
      const preparation = form.get("preparation");
      const data = { name: form.get("name"), categoryId: form.get("categoryId"), basePrice: form.get("basePrice"),
        imageUrl, isAvailable: form.get("isAvailable") === "on", requiresPreparation: preparation === "inherit" ? null : preparation === "yes" };
      void save(product ? { type: "updateProduct", id: product.id, data } : { type: "createProduct", data, stock: Number(form.get("stock")) });
    }} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Product name
          <input name="name" required maxLength={120} defaultValue={product?.name ?? ""} className={inputStyle} autoFocus />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Category
            <select name="categoryId" defaultValue={initialCategory} required className={inputStyle}>
              <option value="">Select a category</option>
              {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Price (Rs)
            <input name="basePrice" type="number" required min="0" max="99999999.99" step="0.01" defaultValue={product?.basePrice ?? ""} className={inputStyle} />
          </label>
        </div>
        {!product && <label className="block text-sm font-medium">Starting stock
          <input name="stock" type="number" required min="0" max="2147483647" step="1" defaultValue="0" className={inputStyle} />
        </label>}
        {product && <p className="text-sm text-slate-500">Current stock: {product.stock}. Use “Adjust stock” to change it separately.</p>}
        <label className="block text-sm font-medium">Kitchen preparation
          <select name="preparation" defaultValue={product?.requiresPreparation == null ? "inherit" : product.requiresPreparation ? "yes" : "no"} className={inputStyle}>
            <option value="inherit">Use category setting</option><option value="yes">Requires preparation</option><option value="no">No preparation needed</option>
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="isAvailable" defaultChecked={product?.isAvailable ?? true} className="h-4 w-4 accent-blue-600" />Available for sale
        </label>
        <p className="text-xs text-slate-500">A product also needs stock and an active category to appear at checkout.</p>
        <ProductImageField value={imageUrl} onChange={setImageUrl} onUploadingChange={setUploading} />
      </fieldset>
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-white/7 pt-4">
        <button type="button" disabled={busy} onClick={onClose} className={buttonStyle}>Cancel</button>
        <button disabled={busy || activeCategories.length === 0} className={primaryStyle}>{uploading ? "Uploading…" : saving ? "Saving…" : "Save product"}</button>
      </div>
    </form>
  </Modal>;
}
