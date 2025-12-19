# Agent Context (AGENTS.md)

This file provides context and instructions for AI agents (and human developers) working on the DB Latency Tracker Agent.

## Project Overview

*   **Goal:** Track database latency and correlate it with application routes (`/* route: ... */`).
*   **Tech Stack:** Node.js (v20-alpine), TypeScript, Docker.
*   **Databases:** PostgreSQL (`pg`), MySQL (`mysql2`).

## Architecture & Logic

*   **Dual-Loop System:**
    *   **Loop A (Tag Sniffer):** frequent polling (1s) to catch transient queries with tags.
    *   **Loop B (Metrics Reporter):** infrequent polling (60s) to aggregate and send stats.
*   **Concurrency:** Use recursive `setTimeout` instead of `setInterval` to prevent overlapping executions and ensure serial processing within each loop.
*   **Sanitization:** Critical for security. All SQL text sent to the API **MUST** be sanitized using `src/utils/sanitizer.ts`.
    *   **Rule:** Replace quoted strings (`'...'`) and numbers with `?`.
*   **Startup Checks:** The agent must fail fast (exit code 1) if required database extensions (`pg_stat_statements` or `performance_schema`) are missing.

## File Structure

*   `src/index.ts`: Entry point. Orchestrates the loops and API reporting.
*   `src/collectors/`: Database-specific logic.
    *   `interface.ts`: Defines `Collector`, `SqlTag`, `QueryMetric`.
*   `src/utils/`: Shared utilities (Logger, Crypto, Sanitizer).
*   `tests/`: Jest tests.

## Development & Testing

*   **Build:** `npm run build` (uses `tsc`).
*   **Test:** `npm test` (uses `jest`).
    *   **Requirement:** Always run tests after modifying `src/utils/sanitizer.ts`.
*   **Formatting:** Follow standard TypeScript conventions.

## Key Constraints

1.  **Memory:** Keep the footprint low (target < 128MB). Avoid storing unbounded arrays.
2.  **Resilience:** Do not crash on API failures. Retry using `axios-retry` and log warnings.
3.  **Dependencies:** Keep `dependencies` minimal for a small Docker image.
