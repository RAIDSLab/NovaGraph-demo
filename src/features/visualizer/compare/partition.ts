import type { PartitionMeta } from "./kinds";
import {
  adjustedRandIndex,
  buildContingency,
  buildSpread,
  matchCommunities,
  normalizedMutualInformation,
  type Membership,
} from "./metrics";

/**
 * Why a node ended up somewhere other than where the matched community says it
 * should be. Greedy matching alone cannot express these, which is why a split
 * community used to read as a pile of unexplained disagreements.
 */
export type PartitionChangeType =
  | "moved"
  | "split"
  | "merged"
  /** Present in the baseline but absent from the current run. */
  | "vanished";

export type PartitionDisagreement = {
  node: string;
  prevCommunity: number;
  /** -1 when the node is absent from the current run. */
  currCommunity: number;
  matchedPrevCommunity: number;
  changeType: PartitionChangeType;
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
  /** Permutation-invariant partition similarity over the shared nodes. */
  ari: number | null;
  nmi: number | null;
  disagreements: PartitionDisagreement[];
};

function buildMembership(partitions: string[][]): Membership {
  const map: Membership = new Map();
  partitions.forEach((group, communityId) => {
    for (const node of group) {
      map.set(node, communityId);
    }
  });
  return map;
}

export function comparePartitions(
  previous: PartitionMeta,
  current: PartitionMeta
): PartitionCompareResult {
  const prevMembership = buildMembership(previous.partitions);
  const currMembership = buildMembership(current.partitions);

  const contingency = buildContingency(prevMembership, currMembership);
  const prevToCurr = matchCommunities(contingency);
  const { prevFanOut, currFanIn } = buildSpread(contingency);

  const disagreements: PartitionDisagreement[] = [];
  let agreedCount = 0;

  for (const [node, prevCommunity] of prevMembership) {
    const currCommunity = currMembership.get(node);
    const matchedPrevCommunity = prevToCurr.get(prevCommunity) ?? -1;

    if (currCommunity == null) {
      disagreements.push({
        node,
        prevCommunity,
        currCommunity: -1,
        matchedPrevCommunity,
        changeType: "vanished",
      });
      continue;
    }

    if (matchedPrevCommunity === currCommunity) {
      agreedCount += 1;
      continue;
    }

    const fanOut = prevFanOut.get(prevCommunity) ?? 1;
    const fanIn = currFanIn.get(currCommunity) ?? 1;
    const changeType: PartitionChangeType =
      fanOut > 1 ? "split" : fanIn > 1 ? "merged" : "moved";

    disagreements.push({
      node,
      prevCommunity,
      currCommunity,
      matchedPrevCommunity,
      changeType,
    });
  }

  disagreements.sort((a, b) => a.node.localeCompare(b.node));

  const totalCompared = contingency.total;

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
    ari: adjustedRandIndex(contingency),
    nmi: normalizedMutualInformation(contingency),
    disagreements,
  };
}
