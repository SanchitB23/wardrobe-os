/**
 * Extracts non-empty related names from a Supabase junction relation, e.g.
 * `item_seasons: { seasons: { name } | null }[]`. Generic over the relation
 * key so any feature's row shape (RecoItemRow, HealthItemRow, ...) can use it.
 */
export function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}
