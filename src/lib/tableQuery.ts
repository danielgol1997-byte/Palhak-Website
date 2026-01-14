import { z } from "zod";

export const FilterOpSchema = z.enum(["eq", "contains", "in", "gte", "lte"]);
export type FilterOp = z.infer<typeof FilterOpSchema>;

export const FilterSchema = z.object({
  id: z.string().min(1),
  op: FilterOpSchema,
  value: z.any(),
});
export type TableFilter = z.infer<typeof FilterSchema>;

const SortDirSchema = z.enum(["asc", "desc"]);
export type SortDir = z.infer<typeof SortDirSchema>;

export const TableQuerySchema = z.object({
  q: z.string().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
  sort: z
    .string()
    .catch("")
    .transform((s) => s.trim())
    .refine((s) => s === "" || /^-?[a-zA-Z0-9_.]+(?::(asc|desc))?$/.test(s), {
      message: "sort_invalid",
    }),
  filters: z
    .string()
    .catch("[]")
    .transform((raw) => {
      try {
        const parsed = JSON.parse(raw);
        const arr = z.array(FilterSchema).safeParse(parsed);
        return arr.success ? arr.data : [];
      } catch {
        return [];
      }
    }),
});

export type TableQuery = z.infer<typeof TableQuerySchema>;

export function parseTableQuery(
  searchParams: Record<string, string | string[] | undefined>,
): TableQuery {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    obj[k] = Array.isArray(v) ? v[0] : v;
  }
  return TableQuerySchema.parse(obj);
}

export function parseSort(
  sortRaw: string,
): { field: string; dir: SortDir } | null {
  const s = sortRaw.trim();
  if (!s) return null;
  const descPrefix = s.startsWith("-");
  const [fieldPart, dirPart] = (descPrefix ? s.slice(1) : s).split(":");
  const dir = dirPart
    ? SortDirSchema.parse(dirPart)
    : descPrefix
      ? "desc"
      : "asc";
  return { field: fieldPart, dir };
}

export function stringifyFilters(filters: TableFilter[]): string {
  return JSON.stringify(filters);
}


