export const ALGORITHM_RUN_STATE_EVENT = "novagraph:algorithm-run-state";
export const ALGORITHM_RENDER_DONE_EVENT = "novagraph:algorithm-render-done";
export const FOCUS_NODE_EVENT = "novagraph:focus-node";

export type AlgorithmRunStateDetail = {
  running: boolean;
  runId?: string;
};

export type AlgorithmRenderDoneDetail = {
  runId: string;
};

/** Focus a graph node by its display label (`pk (tableName)`). */
export type FocusNodeDetail = {
  label: string;
};

export function dispatchFocusNode(label: string) {
  if (!label) return;
  window.dispatchEvent(
    new CustomEvent<FocusNodeDetail>(FOCUS_NODE_EVENT, {
      detail: { label },
    })
  );
}
