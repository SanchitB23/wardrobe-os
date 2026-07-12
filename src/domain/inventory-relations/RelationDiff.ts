/**
 * Pure diff of junction-table ids (RFC-026). Diff semantics — not
 * delete-all + reinsert — so kept item_occasions rows retain their
 * import-provided score/notes.
 */

export type RelationSelections = {
  occasionIds: string[];
  materialIds: string[];
  seasonIds: string[];
};

export function diffIds(
  current: readonly string[],
  next: readonly string[],
): { toInsert: string[]; toDelete: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    toInsert: [...nextSet].filter((id) => !currentSet.has(id)),
    toDelete: [...currentSet].filter((id) => !nextSet.has(id)),
  };
}
