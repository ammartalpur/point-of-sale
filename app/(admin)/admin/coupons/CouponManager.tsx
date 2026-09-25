"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CouponCommand, CouponData } from "@/app/lib/coupon-management";
import { buttonStyle, FormError, inputStyle, Modal, primaryStyle } from "../menu/MenuControls";
import { mutateCoupon } from "./actions";
import OtaqBrand from "@/app/components/OtaqBrand";

type Editor =
  | { kind: "coupon"; coupon?: CouponData }
  | { kind: "confirm"; title: string; description: string; command: CouponCommand };

export default function CouponManager({ coupons, generatedAt }: { coupons: CouponData[]; generatedAt: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(command: unknown) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await mutateCoupon(command);
      if (result.success) { setMessage(result.message); setEditor(null); router.refresh(); }
      else setError(result.error);
    } finally { inFlight.current = false; setBusy(false); }
  }
  const now = new Date(generatedAt).getTime();
  return <main className="min-h-screen bg-[#17110d] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin/dashboard" className="text-sm font-medium text-orange-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">Coupons</h1><p className="mt-1 text-sm text-slate-500">Configure checkout codes, limits and expiry dates.</p></div><div className="flex flex-wrap items-center gap-4"><OtaqBrand /><button className={primaryStyle} onClick={() => setEditor({ kind: "coupon" })}>+ Add coupon</button></div></header>
    {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">{message}</div>}
    <section className="overflow-hidden rounded-2xl border border-white/7 bg-[#211912]"><div className="overflow-x-auto"><table className="w-full min-w-200 text-left text-sm"><thead className="border-b border-white/7 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Code</th><th>Discount</th><th>Minimum</th><th>Expires</th><th>Uses</th><th>Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{coupons.map((coupon) => {
      const expired = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() <= now : false;
      return <tr key={coupon.id}><td className="p-4 font-mono font-bold text-white">{coupon.code}</td><td>{coupon.discountType === "PERCENTAGE" ? `${Number(coupon.value)}%` : `Rs ${coupon.value}`}</td><td>Rs {coupon.minimumSubtotal}</td><td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "Never"}</td><td>{coupon.usageCount}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${coupon.isActive && !expired ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}>{expired ? "Expired" : coupon.isActive ? "Active" : "Disabled"}</span></td><td className="p-4"><div className="flex justify-end gap-2"><button className={buttonStyle} onClick={() => setEditor({ kind: "coupon", coupon })}>Edit</button><button className={buttonStyle} onClick={() => setEditor({ kind: "confirm", title: coupon.isActive ? "Disable coupon" : "Enable coupon", description: `${coupon.isActive ? "Disable" : "Enable"} ${coupon.code}?`, command: { type: "setCouponActive", id: coupon.id, isActive: !coupon.isActive } })}>{coupon.isActive ? "Disable" : "Enable"}</button><button className={`${buttonStyle} text-rose-400`} onClick={() => setEditor({ kind: "confirm", title: "Delete coupon", description: `Delete ${coupon.code}? Used coupons will be disabled to preserve history.`, command: { type: "deleteCoupon", id: coupon.id } })}>Delete</button></div></td></tr>;
    })}</tbody></table></div>{coupons.length === 0 && <p className="p-12 text-center text-sm text-slate-500">No coupons configured.</p>}</section>
  </div>
  {editor?.kind === "coupon" && <CouponEditor coupon={editor.coupon} busy={busy} error={error} onClose={() => setEditor(null)} onSave={save} />}
  {editor?.kind === "confirm" && <Modal title={editor.title} onClose={() => !busy && setEditor(null)}><p className="text-sm text-slate-400">{editor.description}</p><FormError error={error} /><div className="mt-5 flex justify-end gap-2"><button className={buttonStyle} onClick={() => setEditor(null)}>Cancel</button><button className={primaryStyle} disabled={busy} onClick={() => void save(editor.command)}>Confirm</button></div></Modal>}
  </main>;
}

function CouponEditor({ coupon, busy, error, onClose, onSave }: { coupon?: CouponData; busy: boolean; error: string; onClose: () => void; onSave: (command: unknown) => Promise<void> }) {
  const localExpiry = coupon?.expiresAt ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(coupon.expiresAt)).replace(" ", "T") : "";
  return <Modal title={coupon ? "Edit coupon" : "Add coupon"} onClose={() => !busy && onClose()}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSave({ type: "saveCoupon", id: coupon?.id, code: form.get("code"), discountType: form.get("discountType"), value: form.get("value"), minimumSubtotal: form.get("minimumSubtotal"), expiresAt: form.get("expiresAt"), isActive: form.get("active") === "on" }); }}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Code<input name="code" defaultValue={coupon?.code ?? ""} required maxLength={40} className={inputStyle} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Discount type<select name="discountType" defaultValue={coupon?.discountType ?? "PERCENTAGE"} className={inputStyle}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select></label><label className="block text-sm">Value<input name="value" type="number" min="0.01" step="0.01" required defaultValue={coupon?.value ?? ""} className={inputStyle} /></label></div><label className="block text-sm">Minimum subtotal<input name="minimumSubtotal" type="number" min="0" step="0.01" required defaultValue={coupon?.minimumSubtotal ?? "0"} className={inputStyle} /></label><label className="block text-sm">Expiry in Karachi (optional)<input name="expiresAt" type="datetime-local" defaultValue={localExpiry} className={inputStyle} /></label><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={coupon?.isActive ?? true} className="accent-orange-500" />Active</label></fieldset><FormError error={error} /><div className="flex justify-end gap-2"><button type="button" className={buttonStyle} onClick={onClose}>Cancel</button><button className={primaryStyle} disabled={busy}>{busy ? "Saving…" : "Save coupon"}</button></div></form></Modal>;
}
