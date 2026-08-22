/**
 * Whether a refresh should increment the current database's edit counter.
 *
 * Switching databases is not an edit: the destination keeps whatever count
 * its own mutations produced. A periodic refresh only counts as an edit when
 * it stays on the same database and the node or edge count actually moved.
 */
export function shouldBumpGraphRevision(args: {
  previousDatabaseName: string | null | undefined;
  nextDatabaseName: string | null | undefined;
  previousNodeCount: number;
  previousEdgeCount: number;
  nextNodeCount: number;
  nextEdgeCount: number;
}): boolean {
  if (
    args.nextDatabaseName == null ||
    args.previousDatabaseName !== args.nextDatabaseName
  ) {
    return false;
  }
  return (
    args.previousNodeCount !== args.nextNodeCount ||
    args.previousEdgeCount !== args.nextEdgeCount
  );
}
