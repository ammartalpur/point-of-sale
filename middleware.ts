import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/app/lib/auth";

const protectedRoutes = ["/terminal", "/admin"];
const publicRoutes = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route),
  );
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie).catch(() => null) : null;

  // 1. Redirect unauthenticated users to login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirect logged-in users away from public pages (login/register)
  if (isPublicRoute && session) {
    return NextResponse.redirect(
      new URL(
        session.role === "admin" ? "/admin/dashboard" : "/terminal",
        req.nextUrl,
      ),
    );
  }

  // 3. RBAC: Prevent Cashiers from accessing Admin routes
  if (path.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/terminal", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
