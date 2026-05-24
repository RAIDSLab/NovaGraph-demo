/**
 * Entry shim for igraph worker.
 * Vite/React refresh may assume window/document exists in dev mode.
 */
/* eslint-disable @typescript-eslint/no-empty-function */

type MinimalDocNode = {
  style: Record<string, unknown>;
  setAttribute: (...args: unknown[]) => void;
  remove: () => void;
  appendChild?: (...args: unknown[]) => void;
  removeChild?: (...args: unknown[]) => void;
};

const createStubNode = (): MinimalDocNode => ({
  style: {},
  setAttribute: () => {},
  remove: () => {},
});

type DocumentShim = {
  createElement?: (tag: string) => MinimalDocNode;
  head?: {
    appendChild?: (...args: unknown[]) => void;
    removeChild?: (...args: unknown[]) => void;
  };
  body?: {
    appendChild?: (...args: unknown[]) => void;
    removeChild?: (...args: unknown[]) => void;
  };
  documentElement?: MinimalDocNode;
  querySelector?: (...args: unknown[]) => null;
  querySelectorAll?: (...args: unknown[]) => [];
  addEventListener?: (...args: unknown[]) => void;
  removeEventListener?: (...args: unknown[]) => void;
};

type WorkerShimGlobal = Omit<
  typeof globalThis,
  "window" | "self" | "document" | "$RefreshReg$" | "$RefreshSig$"
> & {
  window?: Window & typeof globalThis;
  self?: Window & typeof globalThis;
  document?: DocumentShim;
  $RefreshReg$?: (type: unknown, id: string) => void;
  $RefreshSig$?: () => (type: unknown) => unknown;
  __vite_plugin_react_preamble_installed__?: boolean;
};

type OnMessageHandler = (
  this: Window & typeof globalThis,
  ev: MessageEvent<unknown>
) => unknown;

const globalScope = globalThis as unknown as WorkerShimGlobal;
const windowShim = globalScope as unknown as Window & typeof globalThis;

globalScope.window ??= windowShim;
globalScope.self ??= windowShim;
globalScope.$RefreshReg$ ??= () => {};
globalScope.$RefreshSig$ ??= () => (type) => type;
globalScope.__vite_plugin_react_preamble_installed__ ??= true;

const queuedMessages: MessageEvent<unknown>[] = [];
const queueingHandler: OnMessageHandler = function (event) {
  queuedMessages.push(event);
};

const flushQueuedMessages = () => {
  const handler = globalScope.onmessage as OnMessageHandler | null;
  if (
    typeof handler === "function" &&
    handler !== queueingHandler &&
    queuedMessages.length > 0
  ) {
    const messages = queuedMessages.splice(0);
    for (const message of messages) {
      handler.call(windowShim, message);
    }
  }
};

globalScope.onmessage = queueingHandler as typeof globalScope.onmessage;

if (typeof globalScope.document === "undefined") {
  globalScope.document = {
    createElement: () => createStubNode(),
    head: { appendChild: () => {}, removeChild: () => {} },
    body: { appendChild: () => {}, removeChild: () => {} },
    documentElement: createStubNode(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
} else {
  globalScope.document.createElement ??= () => createStubNode();
  globalScope.document.head ??= {
    appendChild: () => {},
    removeChild: () => {},
  };
  globalScope.document.body ??= {
    appendChild: () => {},
    removeChild: () => {},
  };
  globalScope.document.documentElement ??= createStubNode();
  globalScope.document.querySelector ??= () => null;
  globalScope.document.querySelectorAll ??= () => [];
  globalScope.document.addEventListener ??= () => {};
  globalScope.document.removeEventListener ??= () => {};
}

import("./igraph.worker.impl")
  .then(() => {
    flushQueuedMessages();
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(
      "[Igraph Worker] Failed to initialize implementation:",
      error
    );
    throw error;
  });

export {};
