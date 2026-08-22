# NovaGraph

A **zero-install, local-first** visual graph analytics system for the browser.

Graph analysis is no longer only for database and graph-processing experts. Students, domain scientists, and analysts need to inspect a graph, run standard algorithms, and understand the result. NovaGraph puts that whole path — import, analysis, visual interpretation, local persistence, and export — into one client-side application. There is nothing to install and no remote compute: open a tab, load a graph, and start exploring.

## Why NovaGraph

Lightweight graph analysis needs two things:

- **On-demand analysis.** Run a standard algorithm when you need it — PageRank, BFS, community detection — without first installing a graph database, provisioning a cloud service, or writing Cypher or analysis scripts.
- **Interactive visualisation.** See the result on the graph itself: node colour, size, and highlighted structure stay linked to the algorithm output, not parked in a detached table or a second tool.

NovaGraph is:

- **Zero-install.** Open a browser tab, import a graph, and run common algorithms without installing software, managing a server, or writing query or analysis code.
- **End-to-end.** Import, analyse, inspect on the canvas, persist a local workspace, and export all happen in one environment.
- **Client-side.** [igraph](https://igraph.org/) runs analytics and [Kuzu](https://kuzudb.com/) stores and queries the graph in the browser; computation never leaves the device.
- **In-memory or persistent.** Use a transient graph for a quick experiment, or save a workspace locally (IndexedDB) and reopen it later on the same device.

## Features

- **Import or build a graph.** Load CSV, JSON, TXT, GraphML, or GEXF, or construct typed nodes and edges in a schema-driven editor.
- **Run algorithms without code.** Traversal, path finding, centrality, community detection, and similarity — results are linked back to the canvas (node colour, size, highlighted edges) and a structured output table.
- **Inspect, compare, export.** Step through BFS layers or DFS branches, compare runs (for example Degree vs Betweenness), and save findings as JSON or YAML.
- **Local workspaces.** Keep graphs in memory for a session, or persist them in the browser and switch between workspaces without leaving the page.
- **Optional Cypher.** Write Kuzu Cypher when you want a query; it is not required for the core analysis path.

### Algorithms

| Category | Algorithms |
| --- | --- |
| Traversal & connectivity | BFS, DFS, SCC, WCC, topological sort, random walk, check adjacency |
| Path & reachability | Dijkstra (A–B, A–all), Bellman–Ford (A–B, A–all), Yen, MST, graph diameter, Eulerian path, Eulerian circuit |
| Centrality | PageRank, betweenness, closeness, eigenvector, harmonic, degree, node strength |
| Community detection | Louvain, Leiden, label propagation, fast greedy, k-core, local clustering coefficient, triangle count |
| Similarity & matching | Jaccard, missing-edge prediction |

## Architecture

Four client-side layers, all in the browser:

```
Presentation     React UI + Cosmograph (WebGL)
        │
Orchestration    MainController  (unified db + algorithm API)
        │
   ┌────┴────┐
Storage     Analytics
Kuzu WASM   igraph WASM
IndexedDB   Web Worker
or in-memory
```

The presentation layer never talks to a backend. Orchestration hides whether the graph is persistent or in-memory: both expose the same snapshot interface, so algorithms and the canvas follow one workflow. After an algorithm finishes, results are mapped back onto the visualisation as encodings and as a result table. Persistent mode uses Kuzu-WASM in a Web Worker with IndexedDB; in-memory mode keeps the graph in RAM for fast temporary analysis.

## Getting started

### Live demo

The fastest way to try NovaGraph is the hosted app:

**https://novagraph-flame.vercel.app/**

### Interactive Docker build (recommended)

```bash
./docker-build.sh
```

The script asks for a Kuzu mode, then a service and action:

```
  1. inmemory sync
  2. inmemory async
  3. persistent sync
  4. persistent async   (default)
```

- **Service:** `novagraph-dev` (development) or `novagraph-prod` (production)
- **Action:** `run`, `build`, or `rebuild`

Development is served at `http://localhost:5173`. Production is served at `http://localhost:3000`.

### Manual Docker build

**Development**

```bash
docker build -t novagraph-dev --target development .

docker run --rm -v $(pwd):/host novagraph-dev \
  cp ./src/graph.js ./src/graph.wasm ./src/graph.d.ts /host/src/

docker run -it --rm -v $(pwd):/src -w /src -p 5173:5173 -v /src/node_modules \
  -e NODE_ENV=development \
  -e KUZU_TYPE=persistent \
  -e VITE_KUZU_TYPE=persistent \
  -e KUZU_MODE=async \
  -e VITE_KUZU_MODE=async \
  novagraph-dev
```

Rebuild the image whenever `package.json`, `package-lock.json`, or the WASM sources (`wasm/`) change.

**Production**

```bash
docker build -t novagraph-prod --target=production \
  --build-arg KUZU_TYPE=persistent \
  --build-arg KUZU_MODE=async \
  --build-arg KUZU_DB_PATH=/data/db .

docker run -it -p 3000:3000 novagraph-prod
```

### Local development (without Docker)

```bash
npm install
npm run dev
```

### Kuzu configuration

| Variable | Values | Default | Meaning |
| --- | --- | --- | --- |
| `KUZU_TYPE` | `inmemory` \| `persistent` | `persistent` | In-memory (lost on refresh) vs IndexedDB |
| `KUZU_MODE` | `sync` \| `async` | `async` | Main thread vs Web Worker |
| `KUZU_DB_PATH` | path | — | Optional path for persistent mode |

Production builds bake this in at compile time. Development reads it at runtime.

The containerized app can be deployed to any Docker-capable platform (AWS ECS, Google Cloud Run, Azure Container Apps, Fly.io, Railway, and similar).

## Tech stack

- **Frontend:** React, React Router, Tailwind CSS, MobX
- **Visualization:** Cosmograph (WebGL)
- **Storage & query:** Kuzu WASM
- **Algorithms:** igraph compiled to WebAssembly with Emscripten
