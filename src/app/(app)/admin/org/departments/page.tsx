import DepartmentsPage from "../../departments/page";

export const dynamic = "force-dynamic";

export default async function OrgDepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return DepartmentsPage({ searchParams });
}


