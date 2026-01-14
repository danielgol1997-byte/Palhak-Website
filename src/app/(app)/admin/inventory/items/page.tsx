import ItemsPage, { dynamic } from "../../items/page";

export { dynamic };

export default async function InventoryItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ItemsPage({ searchParams });
}


