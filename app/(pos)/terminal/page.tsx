import { getTerminalMenu } from "./actions";
import { cookies } from "next/headers";
import { decrypt } from "@/app/lib/auth";
import TerminalClient from "./TerminalClient";
import { redirect } from "next/navigation";

export default async function TerminalPage() {
  // 1. Get the current user session securely
  const cookieStore = await cookies();
  const cookie = cookieStore.get("session")?.value;
  if (!cookie) redirect("/login");

  const session = await decrypt(cookie);

  // 2. Fetch the live menu (only items in stock)
  const menuCategories = await getTerminalMenu();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* We pass the data into an interactive Client Component */}
      <TerminalClient categories={menuCategories} cashier={session} />
    </div>
  );
}
