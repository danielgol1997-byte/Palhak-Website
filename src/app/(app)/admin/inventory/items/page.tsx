import ItemsPage from "../../items/page";

export const dynamic = "force-dynamic";

export default async function InventoryItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ItemsPage({ searchParams });
}


