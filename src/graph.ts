/**
 * Graph module entry point for the pure JS (Graphology) version of NovaGraph.
 * Replaces the WASM graph.js - no C++/Emscripten, all algorithms run in JavaScript.
 *
 * Export a factory that returns a Promise resolving to the Graphology adapter,
 * matching the interface expected by IgraphController (same as WASM createModule).
 */

import { GraphologyAdapter } from "./graphology-adapter";
import type { IGraphModule } from "./igraph/types";

/**
 * Creates the graph module (Graphology adapter). Returns a Promise for API
 * compatibility with the WASM createModule which is async.
 */
export default function createModule(): Promise<IGraphModule> {
  return Promise.resolve(new GraphologyAdapter());
}
