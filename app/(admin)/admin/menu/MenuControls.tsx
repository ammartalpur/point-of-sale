"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { mutateMenu } from "./actions";

export const inputStyle = "mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15";
export const buttonStyle = "rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
export const primaryStyle = "rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50";

export function useMenuSave(onSuccess: (message: string) => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function save(input: unknown) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await mutateMenu(input);
      if (result.success) {
        router.refresh();
        onSuccess(result.message);
      } else setError(result.error);
    } catch { setError("The update could not be confirmed. Refresh the menu before trying again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { busy, error, save };
}

export function FormError({ error }: { error: string }) {
  return error ? <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p> : null;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80">
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 id={titleId} className="text-xl font-bold">{title}</h2>
      <button type="button" aria-label="Close dialog" className={buttonStyle} onClick={onClose}>✕</button>
    </div>
    {children}
  </dialog>;
}
