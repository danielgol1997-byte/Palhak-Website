import PositionsPage from "../../positions/page";

export const dynamic = "force-dynamic";

export default async function OrgPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PositionsPage({ searchParams });
}


