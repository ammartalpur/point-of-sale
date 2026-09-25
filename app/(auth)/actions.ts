"use server";

import { prisma } from "@/app/lib/prisma";
import { encrypt } from "@/app/lib/auth";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

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
  void prevState;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 128) return { error: "Password must contain between 8 and 128 characters." };

  const hashedPassword = await bcrypt.hash(password, 10);
  let user: SessionUser | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      user = await prisma.$transaction(async (tx) => {
        if (await tx.profile.count() > 0) {
          throw new Error("SETUP_COMPLETE");
        }
        return tx.profile.create({
          data: { id: randomUUID(), email, password: hashedPassword, role: "admin" },
          select: { id: true, email: true, role: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 15_000 });
      break;
    } catch (error) {
      if (error instanceof Error && error.message === "SETUP_COMPLETE") {
        return { error: "Initial setup is complete. Ask an administrator to create staff access." };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { error: "User already exists." };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  if (!user) return { error: "Account setup could not be completed. Please try again." };

  await createSession(user);
  redirect("/admin/dashboard");
}

export async function loginAction(prevState: Record<string, unknown> | undefined, formData: FormData) {
  void prevState;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

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
