"use client";

// 1. Update import
import { useActionState } from "react";
import { loginAction } from "../actions";
import Link from "next/link";
import OtaqBrand from "@/app/components/OtaqBrand";

export default function LoginPage() {
  // 2. Update hook
  const [state, formAction] = useActionState(loginAction, { error: "" });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17110d] p-4 text-slate-100">
      <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/8 bg-[#211912] p-8 shadow-2xl shadow-black/30">
        <OtaqBrand className="mb-6 justify-center" />
        <h1 className="text-center text-3xl font-bold text-white">Welcome back</h1>
        <p className="mb-7 mt-2 text-center text-sm text-slate-500">Sign in to Otaq Restaurant POS</p>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#17110d] px-3 py-2.5 text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#17110d] px-3 py-2.5 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/15"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{state.error}</div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-white shadow-lg shadow-orange-950/30 hover:bg-orange-400"
          >
            Sign In
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Need an account?{" "}
          <Link href="/register" className="font-medium text-orange-400 hover:text-orange-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
