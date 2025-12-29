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

## BMAD Personas

The project follows the BMAD (Breakthrough Method for Agile AI-Driven Development) framework, utilizing the following AI personas:

### Phase 1: Agentic Planning Personas

*   **The Analyst**
    *   **Role:** Market research, competitive analysis, and project ideation.
    *   **Responsibilities:** Brainstorming sessions, market validation, and initial concept development.
    *   **Artifacts:** Project Brief, market analysis documents, competitive research.

*   **The Product Manager (PM)**
    *   **Role:** Requirements gathering and comprehensive product specification.
    *   **Responsibilities:** Stakeholder requirements translation, feature prioritization, epic definition.
    *   **Artifacts:** PRD.md (Product Requirements Document) containing FRs, NFRs, epics, and acceptance criteria.

*   **The Architect**
    *   **Role:** System design and technical architecture.
    *   **Responsibilities:** Technical feasibility assessment, architectural trade-off decisions.
    *   **Artifacts:** Architecture Documents (system design, tech stack, data flow, API specs).

*   **The Product Owner (PO)**
    *   **Role:** Epic preparation and document sharding for development.
    *   **Responsibilities:** Bridge planning and development phases, prepare epics, ensure architectural alignment.
    *   **Artifacts:** Sharded Epic Files (individual epic documents).

### Phase 2: Context-Engineered Development Personas

*   **The Scrum Master (SM)**
    *   **Role:** Story creation and development task management.
    *   **Responsibilities:** Breaking down epics into executable development tasks.
    *   **Artifacts:** Story Files (`{epicNum}.{storyNum}.story.md`) with implementation guidance and architectural context.

*   **The Developer (Dev)**
    *   **Role:** Code implementation and unit testing.
    *   **Responsibilities:** Converting stories into working software.
    *   **Artifacts:** Source code, unit/integration tests, documentation.

*   **The QA Engineer (Quinn)**
    *   **Role:** Comprehensive quality assurance and validation.
    *   **Responsibilities:** Ensuring code quality, test coverage, and requirement compliance.
    *   **Artifacts:** Risk profiles, test strategies, traceability matrices, quality gate reports.
