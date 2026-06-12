"use server";

import { prisma } from "@/app/lib/prisma";
import { encrypt } from "@/app/lib/auth";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

interface SessionUser {
  id: string;
  email: string;
  role: string;
}

// Helper function to set the cookie
async function createSession(user: SessionUser) {
  const sessionData = { id: user.id, email: user.email, role: user.role };
  const token = await encrypt(sessionData);

  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/",
  });
}

export async function registerAction(prevState: Record<string, unknown> | undefined, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // Default first user to admin, others to cashier (optional logic, but helpful for setup)
  const role = (formData.get("role") as string) || "cashier";

  if (!email || !password) return { error: "Email and password are required." };

  const existingUser = await prisma.profile.findUnique({ where: { email } });
  if (existingUser) return { error: "User already exists." };

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.profile.create({
    data: {
      id: randomUUID(),
      email,
      password: hashedPassword,
      role,
    },
  });

  await createSession(user);
  redirect(user.role === "admin" ? "/admin/dashboard" : "/terminal");
}

export async function loginAction(prevState: Record<string, unknown> | undefined, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required." };

  const user = await prisma.profile.findUnique({ where: { email } });
  if (!user) return { error: "Invalid credentials." };

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return { error: "Invalid credentials." };

  await createSession(user);
  redirect(user.role === "admin" ? "/admin/dashboard" : "/terminal");
}

export async function logoutAction() {
  (await cookies()).delete("session");
  redirect("/login");
}
