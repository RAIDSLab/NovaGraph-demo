/** Node id (or label) to community index. */
export type Membership = Map<string, number>;

export type ContingencyCell = {
  prevCommunity: number;
  currCommunity: number;
  count: number;
};

/**
 * Joint distribution of two partitions over the nodes they share. Built in a
 * single pass so the cost is O(shared nodes) rather than O(prev x curr) set
 * intersections.
 */
export type Contingency = {
  cells: ContingencyCell[];
  prevTotals: Map<number, number>;
  currTotals: Map<number, number>;
  /** Nodes present in both partitions. */
  total: number;
};

export function buildContingency(
  previous: Membership,
  current: Membership
): Contingency {
  const counts = new Map<string, ContingencyCell>();
  const prevTotals = new Map<number, number>();
  const currTotals = new Map<number, number>();
  let total = 0;

  for (const [node, prevCommunity] of previous) {
    const currCommunity = current.get(node);
    if (currCommunity == null) continue;

    total += 1;
    const key = `${prevCommunity},${currCommunity}`;
    const cell = counts.get(key);
    if (cell) {
      cell.count += 1;
    } else {
      counts.set(key, { prevCommunity, currCommunity, count: 1 });
    }
    prevTotals.set(prevCommunity, (prevTotals.get(prevCommunity) ?? 0) + 1);
    currTotals.set(currCommunity, (currTotals.get(currCommunity) ?? 0) + 1);
  }

  return { cells: [...counts.values()], prevTotals, currTotals, total };
}

const choose2 = (n: number): number => (n * (n - 1)) / 2;

/**
 * Adjusted Rand Index over the shared nodes. Permutation invariant, so unlike a
 * matched-membership agreement rate it needs no community pairing and is not
 * penalised when a community splits or merges.
 *
 * Returns 1 for degenerate cases where neither partition contains a
 * distinguishable pair, matching the usual convention.
 */
export function adjustedRandIndex(contingency: Contingency): number | null {
  const { cells, prevTotals, currTotals, total } = contingency;
  if (total < 2) return null;

  let sumCells = 0;
  for (const cell of cells) sumCells += choose2(cell.count);

  let sumPrev = 0;
  for (const count of prevTotals.values()) sumPrev += choose2(count);

  let sumCurr = 0;
  for (const count of currTotals.values()) sumCurr += choose2(count);

  const totalPairs = choose2(total);
  const expected = (sumPrev * sumCurr) / totalPairs;
  const maximum = (sumPrev + sumCurr) / 2;

  if (maximum === expected) return 1;
  const ari = (sumCells - expected) / (maximum - expected);
  return ari < -1 ? -1 : ari > 1 ? 1 : ari;
}

/**
 * Normalised mutual information, 2I(X;Y) / (H(X) + H(Y)), over the shared
 * nodes. Also permutation invariant. Returns 1 when both partitions are a
 * single community, since they agree completely and carry no entropy.
 */
export function normalizedMutualInformation(
  contingency: Contingency
): number | null {
  const { cells, prevTotals, currTotals, total } = contingency;
  if (total === 0) return null;

  const entropy = (totals: Map<number, number>): number => {
    let value = 0;
    for (const count of totals.values()) {
      if (count === 0) continue;
      const p = count / total;
      value -= p * Math.log(p);
    }
    return value;
  };

  const entropyPrev = entropy(prevTotals);
  const entropyCurr = entropy(currTotals);
  const denominator = entropyPrev + entropyCurr;
  if (denominator === 0) return 1;

  let mutualInformation = 0;
  for (const cell of cells) {
    if (cell.count === 0) continue;
    const pJoint = cell.count / total;
    const pPrev = (prevTotals.get(cell.prevCommunity) ?? 0) / total;
    const pCurr = (currTotals.get(cell.currCommunity) ?? 0) / total;
    if (pPrev === 0 || pCurr === 0) continue;
    mutualInformation += pJoint * Math.log(pJoint / (pPrev * pCurr));
  }

  const nmi = (2 * mutualInformation) / denominator;
  return nmi < 0 ? 0 : nmi > 1 ? 1 : nmi;
}

/**
 * Greedy one-to-one pairing of previous communities onto current ones by
 * shared member count. Used only to label individual nodes; the summary metrics
 * above deliberately avoid depending on a pairing.
 */
export function matchCommunities(
  contingency: Contingency
): Map<number, number> {
  const ordered = [...contingency.cells].sort((a, b) => b.count - a.count);

  const matchedPrev = new Set<number>();
  const matchedCurr = new Set<number>();
  const mapping = new Map<number, number>();

  for (const cell of ordered) {
    if (
      matchedPrev.has(cell.prevCommunity) ||
      matchedCurr.has(cell.currCommunity)
    ) {
      continue;
    }
    mapping.set(cell.prevCommunity, cell.currCommunity);
    matchedPrev.add(cell.prevCommunity);
    matchedCurr.add(cell.currCommunity);
  }

  return mapping;
}

/** How many distinct current communities each previous community fed into, and vice versa. */
export function buildSpread(contingency: Contingency): {
  prevFanOut: Map<number, number>;
  currFanIn: Map<number, number>;
} {
  const prevTargets = new Map<number, Set<number>>();
  const currSources = new Map<number, Set<number>>();

  for (const cell of contingency.cells) {
    if (cell.count === 0) continue;
    const targets = prevTargets.get(cell.prevCommunity) ?? new Set<number>();
    targets.add(cell.currCommunity);
    prevTargets.set(cell.prevCommunity, targets);

    const sources = currSources.get(cell.currCommunity) ?? new Set<number>();
    sources.add(cell.prevCommunity);
    currSources.set(cell.currCommunity, sources);
  }

  const prevFanOut = new Map<number, number>();
  for (const [id, targets] of prevTargets) prevFanOut.set(id, targets.size);

  const currFanIn = new Map<number, number>();
  for (const [id, sources] of currSources) currFanIn.set(id, sources.size);

  return { prevFanOut, currFanIn };
}
