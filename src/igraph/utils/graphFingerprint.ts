import type { KuzuToIgraphParseResult } from "../types";
import { parseKuzuToIgraphInput } from "./parseKuzuToIgraphInput";

import type { GraphEdge, GraphNode } from "~/features/visualizer/types";

const FNV32_OFFSET_BASIS = 0x811c9dc5;
const FNV32_PRIME = 0x01000193;
const floatScratch = new Float64Array(1);
const uintScratch = new Uint32Array(floatScratch.buffer);

const fnvUpdate = (hash: number, value: number): number =>
  Math.imul(hash ^ (value >>> 0), FNV32_PRIME) >>> 0;

const hashFloat64 = (hash: number, value: number): number => {
  floatScratch[0] = Number.isFinite(value) ? value : 0;
  let next = fnvUpdate(hash, uintScratch[0]);
  next = fnvUpdate(next, uintScratch[1]);
  return next;
};

export const computeGraphFingerprint = (
  parseResult: KuzuToIgraphParseResult
): string => {
  const input = parseResult.IgraphInput;
  let hash = FNV32_OFFSET_BASIS;

  hash = fnvUpdate(hash, input.nodes);
  hash = fnvUpdate(hash, input.directed ? 1 : 0);
  hash = fnvUpdate(hash, input.src.length);

  for (let i = 0; i < input.src.length; i++) {
    hash = fnvUpdate(hash, input.src[i]);
    hash = fnvUpdate(hash, input.dst[i]);
    if (input.weight) {
      hash = hashFloat64(hash, input.weight[i] ?? 0);
    }
  }

  return hash.toString(16);
};

export const computeSnapshotGraphVersion = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  directed: boolean
): string => {
  const parseResult = parseKuzuToIgraphInput(nodes, edges, directed);
  return computeGraphFingerprint(parseResult);
};
