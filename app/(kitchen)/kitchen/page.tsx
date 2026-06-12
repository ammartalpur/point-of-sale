import { getActiveKitchenOrders } from "./action";
import KitchenClient from "./KitchenClient";

// Force Next.js to render this dynamically so we always get fresh data
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const initialOrders = await getActiveKitchenOrders();

  return <KitchenClient initialOrders={initialOrders} />;
}
