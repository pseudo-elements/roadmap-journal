import { createRoadmap, createNode } from './db.js';
import { awardXP, XP_VALUES } from './gamification.js';

export const CURATED_PRESETS = [
  {
    id: 'preset_frontend',
    title: 'Frontend Web Engineering',
    category: 'Web Architecture',
    description: 'Mastery pathway for modern browser systems, reactive interfaces, rendering pipelines, and accessible UI engineering.',
    nodes: [
      { title: 'The Internet, Browsers & DOM Rendering Engine', notes: 'How DNS, TCP/IP, TLS handshakes, DOM construction, and CSSOM styling pipelines function in modern browser engines.' },
      { title: 'Semantic HTML5, Living Standards & Accessibility (a11y)', notes: 'ARIA landmarks, accessible keyboard navigation, semantic outline trees, and screen reader compatibilities.' },
      { title: 'CSS3 Architecture: Flexbox, CSS Grid & Fluid Typography', notes: 'Modern layout primitives, subgrid, intrinsic design patterns, CSS custom properties, and container queries.' },
      { title: 'Core ECMAScript 2026: Scope, Closures & Event Loop', notes: 'Lexical environments, execution context stack, task queues, microtasks, event loop, and memory leaks.' },
      { title: 'Asynchronous JavaScript: Promises, Async/Await & Fetch API', notes: 'Asynchronous control flow, AbortController, error boundaries, streaming responses, and cancellation.' },
      { title: 'Client-Side Storage: IndexedDB, Cache API & Service Workers', notes: 'Offline-first architectural patterns, Dexie.js persistence, CacheStorage, and background sync.' },
      { title: 'Modern Build Tools: Vite, ES Modules & Bundling', notes: 'Tree shaking, code splitting, rollup plugins, source maps, and dependency pre-bundling.' },
      { title: 'Component-Driven Architecture & Reactive State Machines', notes: 'Unidirectional data flow, reactive signals, render cycle reconciliation, and state isolation.' },
      { title: 'Web Performance Optimization & Core Web Vitals', notes: 'LCP, INP, CLS optimization, critical rendering path tuning, lazy loading, and asset compression.' },
      { title: 'Testing Strategies: Unit, Integration & End-to-End', notes: 'Unit testing primitives, component visual regression, mock service workers, and automated test runners.' }
    ]
  },
  {
    id: 'preset_backend',
    title: 'Distributed Backend & Systems Architecture',
    category: 'Systems & Infrastructure',
    description: 'A deep architectural roadmap covering distributed consensus, database engineering, API gateways, and cloud scalability.',
    nodes: [
      { title: 'Transport Protocols: HTTP/2, HTTP/3, QUIC & WebSockets', notes: 'Multiplexing, stream prioritization, head-of-line blocking mitigation, binary framing, and bidirectional streams.' },
      { title: 'RESTful Protocols, OpenAPI & GraphQL Architecture', notes: 'Contract-first API design, idempotent methods, hypermedia, schema stitching, and query complexity analysis.' },
      { title: 'Relational Database Engineering & PostgreSQL Internals', notes: 'ACID transactions, write-ahead logging (WAL), B-Trees, GiST/GIN indexing, and query plan optimization.' },
      { title: 'Distributed In-Memory Caching & Cache Invalidation', notes: 'Cache-aside, write-through, write-behind, Redis data structures, eviction policies (LRU/LFU), and stampede protection.' },
      { title: 'Authentication, Authorization & Federated Identity (OAuth2 / OIDC)', notes: 'Token lifecycles, asymmetric JWT validation, cryptographic nonces, role-based access control, and PKCE.' },
      { title: 'Event-Driven Architectures & Message Brokers', notes: 'Partitioning, consumer groups, offset management in Kafka/RabbitMQ, at-least-once vs exactly-once semantics.' },
      { title: 'Containerization, Linux Namespaces & cgroups', notes: 'Container runtimes, layered storage filesystems, process isolation, resource quotas, and image optimization.' },
      { title: 'Microservices & Distributed Transactions', notes: 'Saga patterns (orchestration vs choreography), two-phase commits, outbox pattern, and idempotency keys.' },
      { title: 'High Availability: Sharding, Replication & CAP Theorem', notes: 'Quorum consensus, Raft protocol, primary-replica topologies, conflict resolution, and partition tolerance.' },
      { title: 'Observability: Distributed Tracing, Metrics & Structured Logs', notes: 'OpenTelemetry instrumentation, trace context propagation, percentile metrics (p95/p99), and SLIs/SLOs.' }
    ]
  },
  {
    id: 'preset_ai_llm',
    title: 'Applied AI & Large Language Model Engineering',
    category: 'Machine Learning',
    description: 'Architecting production AI applications: transformers, embeddings, retrieval-augmented generation (RAG), and agentic workflows.',
    nodes: [
      { title: 'Mathematical Foundations: Vectors, Tensors & Linear Algebra', notes: 'Dot products, cosine similarity, high-dimensional spaces, matrix transformations, and gradient descent.' },
      { title: 'Transformer Architecture & Self-Attention Mechanisms', notes: 'Multi-head attention, positional encodings, decoder-only architectures, kv-caching, and context windows.' },
      { title: 'Tokenization, Embeddings & Vector Representations', notes: 'Byte-pair encoding (BPE), semantic embedding models, semantic distance metrics, and dimensionality reduction.' },
      { title: 'Vector Databases & Approximate Nearest Neighbor (ANN)', notes: 'HNSW indexing, IVF-Flat, metadata filtering, chunking strategies, and hybrid sparse-dense search.' },
      { title: 'Advanced Retrieval-Augmented Generation (RAG)', notes: 'Query expansion, reranking cross-encoders, reciprocal rank fusion, parent-child chunking, and contextual compression.' },
      { title: 'Structured Generation & Schema Enforcement', notes: 'Constrained decoding, JSON schema validation, grammar-guided sampling, and tool definition calling.' },
      { title: 'Agentic Systems & Autonomous Tool Calling', notes: 'ReAct patterns, planning loops, error recovery, function execution environments, and state management.' },
      { title: 'Model Fine-Tuning & Parameter-Efficient Adaptation (LoRA)', notes: 'Low-Rank Adaptation, instruction tuning datasets, loss curves, and quantized weights (QLoRA).' },
      { title: 'LLM Evaluation, Red-Teaming & Safety Guardrails', notes: 'Automated evaluation frameworks (G-Eval, RAGAS), prompt injection defense, and output sanitization.' }
    ]
  },
  {
    id: 'preset_cs_fundamentals',
    title: 'Computer Science & Algorithmic Cartography',
    category: 'Computer Science',
    description: 'The timeless theoretical bedrock of computation: algorithms, complexity analysis, data structures, and computer organization.',
    nodes: [
      { title: 'Asymptotic Analysis & Big-O Notation', notes: 'Time and space complexity bounds, amortized analysis, recurrence relations, and Master Theorem.' },
      { title: 'Elementary Data Structures: Arrays, Linked Lists & Stacks', notes: 'Contiguous vs linked memory layout, dynamic array resizing amortization, call stack simulation, and pointer arithmetic.' },
      { title: 'Hierarchical Trees, Binary Search Trees & Heaps', notes: 'Tree traversals, self-balancing rotations, priority queues, min/max heap invariants, and heap sort.' },
      { title: 'Hash Tables, Collision Resolution & Bloom Filters', notes: 'Hash functions, open addressing, separate chaining, probabilistic membership filters, and load factor tuning.' },
      { title: 'Graph Algorithms: Traversal, Shortest Path & Spanning Trees', notes: 'Breadth-First Search, Depth-First Search, Dijkstra algorithm, Bellman-Ford, A*, and Kruskal/Prim MST.' },
      { title: 'Dynamic Programming & Memoization Techniques', notes: 'Optimal substructure, overlapping subproblems, top-down memoization, bottom-up tabulation, and knapsack variants.' },
      { title: 'Operating Systems: Concurrency, Threads & Synchronization', notes: 'Race conditions, mutex locks, semaphores, deadlock conditions, context switching, and atomics.' },
      { title: 'Computer Memory Hierarchy & CPU Cache Locality', notes: 'Registers, L1/L2/L3 caches, cache lines, false sharing, virtual memory paging, and page fault handling.' }
    ]
  }
];

export function getAvailablePresets() {
  return CURATED_PRESETS;
}

/**
 * Parses and imports roadmap JSON data into the database.
 * Supports:
 * - Curated preset object
 * - Custom exported JSON format
 * - roadmap.sh graph format (nodes with data.label or title)
 *
 * @param {string|Object} rawData
 * @returns {Promise<Object>} Created roadmap object
 */
export async function importRoadmapJson(rawData) {
  let parsed;
  if (typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData);
    } catch (err) {
      throw new Error(`Failed to parse roadmap JSON: ${err.message}`);
    }
  } else if (typeof rawData === 'object' && rawData !== null) {
    parsed = rawData;
  } else {
    throw new Error('Invalid input: Expected JSON string or object.');
  }

  // Detect roadmap.sh JSON structure vs standard format
  let title = parsed.title || parsed.name || 'Imported Field Roadmap';
  let description = parsed.description || parsed.meta?.description || 'Imported technical curriculum pathway.';
  let category = parsed.category || 'Engineering';
  let sourceUrl = parsed.sourceUrl || parsed.url || '';
  let rawNodes = [];

  if (Array.isArray(parsed.nodes)) {
    rawNodes = parsed.nodes;
  } else if (Array.isArray(parsed.children)) {
    rawNodes = parsed.children;
  } else if (parsed.json && Array.isArray(parsed.json.nodes)) {
    rawNodes = parsed.json.nodes;
    title = parsed.json.title || title;
  } else if (Array.isArray(parsed.data?.nodes)) {
    rawNodes = parsed.data.nodes;
  }

  if (rawNodes.length === 0) {
    throw new Error('No topic nodes found in the provided roadmap structure.');
  }

  // Create the roadmap in Dexie
  const createdRoadmap = await createRoadmap({
    title,
    description,
    category,
    sourceUrl
  });

  // Normalize and insert nodes
  let orderIndex = 1;
  for (const nodeItem of rawNodes) {
    // Handle roadmap.sh nodes which often have { data: { label: '...' } } or { title: '...' }
    let nodeTitle = '';
    let nodeNotes = '';

    if (typeof nodeItem === 'string') {
      nodeTitle = nodeItem;
    } else if (nodeItem && typeof nodeItem === 'object') {
      nodeTitle = nodeItem.title || nodeItem.data?.label || nodeItem.label || nodeItem.name || nodeItem.id || `Topic ${orderIndex}`;
      nodeNotes = nodeItem.notes || nodeItem.data?.description || nodeItem.description || '';
    }

    if (nodeTitle && nodeTitle.trim()) {
      // Filter out purely decorative or structural group node labels if desired, or include them
      await createNode({
        roadmapId: createdRoadmap.id,
        title: nodeTitle.trim(),
        notes: nodeNotes.trim(),
        order: orderIndex++,
        status: 'pending'
      });
    }
  }

  // Award XP for creating / importing roadmap
  await awardXP(XP_VALUES.NODE_CREATED * 2, `Imported Roadmap: ${createdRoadmap.title}`);

  return createdRoadmap;
}
