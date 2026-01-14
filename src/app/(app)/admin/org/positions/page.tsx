import PositionsPage, { dynamic } from "../../positions/page";

export { dynamic };

export default async function OrgPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PositionsPage({ searchParams });
}


