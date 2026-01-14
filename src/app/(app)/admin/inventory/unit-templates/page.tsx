import UnitTemplatesPage from "../../unit-templates/page";

export const dynamic = "force-dynamic";

export default async function InventoryUnitTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return UnitTemplatesPage({ searchParams });
}


