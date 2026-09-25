import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/app/lib/auth";

const protectedRoutes = ["/terminal", "/admin", "/kitchen", "/receipt"];
const publicRoutes = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);
  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie).catch(() => null) : null;

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL(session.role === "admin" ? "/admin/dashboard" : "/terminal", req.nextUrl));
  }
  if (path.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/terminal", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
