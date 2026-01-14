import DepartmentsPage, { dynamic } from "../../departments/page";

export { dynamic };

export default async function OrgDepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return DepartmentsPage({ searchParams });
}


