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

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return databaseErrorCode(error.cause);
  return undefined;
}

function reportAuthError(operation: string, error: unknown) {
  console.error(operation, {
    name: error instanceof Error ? error.name : "DatabaseError",
    code: databaseErrorCode(error),
    message: error instanceof Error ? error.message : "The database request failed.",
  });
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
  const role = String(formData.get("role") ?? "").trim().toLowerCase();

  if (!email || !password) return { error: "Email and password are required." };
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 128) return { error: "Password must contain between 8 and 128 characters." };
  if (role !== "admin" && role !== "cashier") return { error: "Choose Admin or Cashier before registering." };

  const hashedPassword = await bcrypt.hash(password, 10);
  let user: SessionUser;
  try {
    user = await prisma.profile.create({
      data: { id: randomUUID(), email, password: hashedPassword, role },
      select: { id: true, email: true, role: true },
    });
  } catch (error) {
    if (databaseErrorCode(error) === "P2002" || error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists. Log in instead." };
    }
    reportAuthError("Registration failed", error);
    return { error: "Registration could not connect to the database. Please try again." };
  }

  try {
    await createSession(user);
  } catch (error) {
    reportAuthError("Registration session failed", error);
    return { error: "The account was created, but sign-in could not be completed. Log in with the new account." };
  }
  redirect(role === "admin" ? "/admin/dashboard" : "/terminal");
}

export async function loginAction(prevState: Record<string, unknown> | undefined, formData: FormData) {
  void prevState;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedRole = String(formData.get("role") ?? "").trim().toLowerCase();

  if (!email || !password) return { error: "Email and password are required." };
  if (requestedRole !== "admin" && requestedRole !== "cashier") {
    return { error: "Choose Admin or Cashier before signing in." };
  }

  let user: (SessionUser & { password: string }) | null;
  try {
    user = await prisma.profile.findUnique({ where: { email } });
  } catch (error) {
    reportAuthError("Login lookup failed", error);
    return { error: "Login could not connect to the database. Please try again." };
  }
  if (!user) return { error: "Invalid credentials." };

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return { error: "Invalid credentials." };
  if (user.role !== requestedRole) {
    return { error: `This account is registered as ${user.role === "admin" ? "an administrator" : "a cashier"}. Choose the matching login type.` };
  }

  try {
    await createSession(user);
  } catch (error) {
    reportAuthError("Login session failed", error);
    return { error: "Login could not be completed. Please try again." };
  }
  redirect(requestedRole === "admin" ? "/admin/dashboard" : "/terminal");
}

export async function logoutAction() {
  (await cookies()).delete("session");
  redirect("/login");
}
