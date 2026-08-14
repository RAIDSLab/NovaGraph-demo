import type { PartitionMeta } from "./kinds";

export type PartitionDisagreement = {
  node: string;
  prevCommunity: number;
  currCommunity: number;
  matchedPrevCommunity: number;
};

export type PartitionCompareResult = {
  agreementPercent: number;
  agreedCount: number;
  totalCompared: number;
  prevCommunityCount: number;
  currCommunityCount: number;
  prevModularity?: number;
  currModularity?: number;
  prevQuality?: number;
  currQuality?: number;
  disagreements: PartitionDisagreement[];
};

function buildMembership(partitions: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  partitions.forEach((group, communityId) => {
    for (const node of group) {
      map.set(node, communityId);
    }
  });
  return map;
}

/**
 * Greedy one-to-one matching of previous communities onto current communities
 * by maximizing shared member count.
 */
function matchCommunities(
  previous: string[][],
  current: string[][]
): Map<number, number> {
  const prevSets = previous.map((group) => new Set(group));
  const currSets = current.map((group) => new Set(group));

  type Pair = { prevId: number; currId: number; overlap: number };
  const pairs: Pair[] = [];

  for (let prevId = 0; prevId < prevSets.length; prevId++) {
    for (let currId = 0; currId < currSets.length; currId++) {
      let overlap = 0;
      for (const node of prevSets[prevId]) {
        if (currSets[currId].has(node)) overlap += 1;
      }
      if (overlap > 0) {
        pairs.push({ prevId, currId, overlap });
      }
    }
  }

  pairs.sort((a, b) => b.overlap - a.overlap);

  const matchedPrev = new Set<number>();
  const matchedCurr = new Set<number>();
  const mapping = new Map<number, number>();

  for (const pair of pairs) {
    if (matchedPrev.has(pair.prevId) || matchedCurr.has(pair.currId)) continue;
    mapping.set(pair.prevId, pair.currId);
    matchedPrev.add(pair.prevId);
    matchedCurr.add(pair.currId);
  }

  return mapping;
}

export function comparePartitions(
  previous: PartitionMeta,
  current: PartitionMeta
): PartitionCompareResult {
  const prevMembership = buildMembership(previous.partitions);
  const currMembership = buildMembership(current.partitions);
  const prevToCurr = matchCommunities(previous.partitions, current.partitions);

  const nodes = new Set([...prevMembership.keys(), ...currMembership.keys()]);
  const disagreements: PartitionDisagreement[] = [];
  let agreedCount = 0;
  let totalCompared = 0;

  for (const node of nodes) {
    const prevCommunity = prevMembership.get(node);
    const currCommunity = currMembership.get(node);
    if (prevCommunity == null || currCommunity == null) continue;

    totalCompared += 1;
    const matchedPrevCommunity = prevToCurr.get(prevCommunity);
    const agrees =
      matchedPrevCommunity != null && matchedPrevCommunity === currCommunity;

    if (agrees) {
      agreedCount += 1;
    } else {
      disagreements.push({
        node,
        prevCommunity,
        currCommunity,
        matchedPrevCommunity: matchedPrevCommunity ?? -1,
      });
    }
  }

  disagreements.sort((a, b) => a.node.localeCompare(b.node));

  return {
    agreementPercent:
      totalCompared === 0 ? 0 : (agreedCount / totalCompared) * 100,
    agreedCount,
    totalCompared,
    prevCommunityCount: previous.partitions.length,
    currCommunityCount: current.partitions.length,
    prevModularity: previous.modularity,
    currModularity: current.modularity,
    prevQuality: previous.quality,
    currQuality: current.quality,
    disagreements,
  };
}
