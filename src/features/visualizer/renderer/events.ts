export const ALGORITHM_RUN_STATE_EVENT = "novagraph:algorithm-run-state";
export const ALGORITHM_RENDER_DONE_EVENT = "novagraph:algorithm-render-done";

export type AlgorithmRunStateDetail = {
  running: boolean;
  runId?: string;
};

export type AlgorithmRenderDoneDetail = {
  runId: string;
};
