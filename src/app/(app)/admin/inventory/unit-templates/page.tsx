import UnitTemplatesPage, { dynamic } from "../../unit-templates/page";

export { dynamic };

export default async function InventoryUnitTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return UnitTemplatesPage({ searchParams });
}


