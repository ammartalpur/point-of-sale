"use client";

// 1. Update import
import { useActionState } from "react";
import { loginAction } from "../actions";
import Link from "next/link";

export default function LoginPage() {
  // 2. Update hook
  const [state, formAction] = useActionState(loginAction, { error: "" });

  return (
    // ... rest of the code remains exactly the same
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">
          System Login
        </h1>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
            />
          </div>

          {state?.error && (
            <div className="text-sm text-red-500">{state.error}</div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 py-2.5 text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Need an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
