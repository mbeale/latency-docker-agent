# DB Latency Tracker Agent

A lightweight, stateless Node.js agent designed to run as a sidecar. It connects to PostgreSQL or MySQL databases, extracts performance metadata, sanitizes it to remove PII, and pushes it to a central Ingestion API.

## Architecture

The agent operates using two concurrent, non-blocking loops:

1.  **Tag Sniffer (High Frequency - 1s):**
    *   Polls `pg_stat_activity` (Postgres) or `performance_schema.events_statements_current` (MySQL).
    *   Captures SQL queries containing `/* route: ... */` tags.
    *   Maps the query hash to the route name in a local LRU cache.

2.  **Metrics Reporter (Low Frequency - 60s):**
    *   Polls `pg_stat_statements` (Postgres) or `events_statements_summary_by_digest` (MySQL) for aggregated metrics.
    *   Sanitizes query text (removes PII).
    *   Enriches metrics with route names from the Tag Sniffer cache.
    *   Sends a JSON payload to the Ingestion API.

### Key Components

*   **Collectors:** Database-specific implementations (`src/collectors/`) for fetching data.
*   **Sanitizer:** A regex-based utility (`src/utils/sanitizer.ts`) to strip literals and numbers from SQL queries.
*   **Resilience:** Uses `axios-retry` for API requests and proper error handling for database connections.

## Configuration

The agent is configured via environment variables.

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | Database connection string (e.g., `postgres://user:pass@host:5432/db`) | - |
| `INGESTION_TOKEN` | Yes | Bearer token for the Ingestion API | - |
| `API_URL` | No | URL of the Ingestion Backend | `https://api.your-saas.com` |
| `POLL_INTERVAL_SEC` | No | Interval for sending metrics (seconds) | `60` |
| `DB_TYPE` | No | Database type: `postgres` or `mysql` | `postgres` |

## How to Run

### Using Docker

The project includes a multi-stage `Dockerfile`.

1.  **Build the image:**
    ```bash
    docker build -t db-tracker-agent .
    ```

2.  **Run the container:**
    ```bash
    docker run -d \
      -e DATABASE_URL="postgres://user:pass@host:5432/db" \
      -e INGESTION_TOKEN="your-token" \
      db-tracker-agent
    ```

### Local Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Build the project:**
    ```bash
    npm run build
    ```

3.  **Run the agent:**
    ```bash
    # Create a .env file with required variables first
    npm start
    ```

    Or for development with hot-reload:
    ```bash
    npm run dev
    ```

## Testing

The project uses `jest` for testing.

```bash
npm test
```

Currently, tests focus on the **Sanitizer** module to ensure PII is correctly stripped from queries.
