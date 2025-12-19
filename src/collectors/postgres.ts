import { Pool } from 'pg';
import { Collector, SqlTag, QueryMetric } from './interface';
import { config } from '../config';
import { logger } from '../utils/logger';
import { computeHash } from '../utils/crypto';
import { sanitizer } from '../utils/sanitizer';

export class PostgresCollector implements Collector {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
    });
  }

  async init(): Promise<void> {
    try {
        await this.pool.query('SELECT 1');
        logger.info('Connected to Postgres');

        // Check for pg_stat_statements
        try {
            await this.pool.query('SELECT * FROM pg_stat_statements LIMIT 0');
        } catch (err: any) {
            if (err.code === '42P01') { // undefined_table
                 logger.error('CRITICAL: pg_stat_statements extension missing or not enabled.');
                 process.exit(1);
            }
            throw err;
        }

    } catch (err) {
        logger.error('Failed to connect to Postgres or verify extensions', err);
        // Do not exit, just log. The orchestrator will keep trying to call collect methods which might fail but should be handled.
        // Wait, if extension check failed we already exited. If connection failed, we continue.
    }
  }

  async collectTags(): Promise<SqlTag[]> {
    const tags: SqlTag[] = [];
    try {
        // Query pg_stat_activity
        // Filter for queries containing the comment pattern /* route: ... */
        const query = `
            SELECT query
            FROM pg_stat_activity
            WHERE state = 'active'
              AND query LIKE '%/* route: %'
              AND query NOT LIKE '%pg_stat_activity%'
        `;
        const res = await this.pool.query(query);

        for (const row of res.rows) {
            const sql = row.query;
            const routeMatch = sql.match(/\/\* route: (.*?) \*\//);
            if (routeMatch && routeMatch[1]) {
                const routeName = routeMatch[1].trim();
                // Normalized hash computation needs to match what we do in metrics collection
                // We should sanitize before hashing to be consistent, as pg_stat_statements usually stores normalized queries?
                // Actually PRD says: "Compute the query_hash (MD5 of the normalized query)."
                // pg_stat_statements stores normalized query text.
                // But here we capture raw query.
                // If we want to match pg_stat_statements, we need to apply similar normalization.
                // The sanitizer we built does similar things (replacing literals with ?).

                const cleanSql = sanitizer.clean(sql);
                const queryHash = computeHash(cleanSql);
                tags.push({ queryHash, routeName });
            }
        }
    } catch (err) {
        logger.error('Error collecting tags (PG)', err);
    }
    return tags;
  }

  async collectMetrics(): Promise<QueryMetric[]> {
    const metrics: QueryMetric[] = [];
    try {
        // Query pg_stat_statements
        // Columns: query, total_exec_time (or total_time depending on version), calls, rows
        // Note: pg_stat_statements versions differ. >= 1.8 uses total_exec_time. Older use total_time.
        // We'll try to select columns safely or just try one.

        // Checking for extension existence should be done at startup, but for resilience we check here or just catch error.

        const query = `
            SELECT
                query,
                calls,
                total_exec_time,
                rows
            FROM pg_stat_statements
            LIMIT 1000
        `;

        const res = await this.pool.query(query);

        for (const row of res.rows) {
             const rawQuery = row.query;
             const cleanQuery = sanitizer.clean(rawQuery);
             const queryHash = computeHash(cleanQuery);

             metrics.push({
                 queryHash,
                 queryText: cleanQuery,
                 avgLatency: row.calls > 0 ? row.total_exec_time / row.calls : 0,
                 callCount: parseInt(row.calls, 10),
                 rowsProcessed: parseInt(row.rows, 10)
             });
        }

    } catch (err: any) {
        logger.error('Error collecting metrics (PG)', err);
    }
    return metrics;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
