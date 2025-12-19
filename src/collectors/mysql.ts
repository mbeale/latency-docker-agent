import mysql from 'mysql2/promise';
import { Collector, SqlTag, QueryMetric } from './interface';
import { config } from '../config';
import { logger } from '../utils/logger';
import { computeHash } from '../utils/crypto';
import { sanitizer } from '../utils/sanitizer';

export class MysqlCollector implements Collector {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(config.databaseUrl);
  }

  async init(): Promise<void> {
    try {
        await this.pool.query('SELECT 1');
        logger.info('Connected to MySQL');

        // Check for performance_schema
        try {
            await this.pool.query('SELECT * FROM performance_schema.events_statements_summary_by_digest LIMIT 0');
        } catch (err: any) {
             if (err.code === 'ER_NO_SUCH_TABLE') {
                 logger.error('CRITICAL: performance_schema missing or not enabled.');
                 process.exit(1);
             }
             throw err;
        }

    } catch (err) {
        logger.error('Failed to connect to MySQL or verify extensions', err);
    }
  }

  async collectTags(): Promise<SqlTag[]> {
    const tags: SqlTag[] = [];
    try {
        // Query performance_schema.events_statements_current
        const query = `
            SELECT SQL_TEXT
            FROM performance_schema.events_statements_current
            WHERE SQL_TEXT LIKE '%/* route: %'
        `;
        const [rows] = await this.pool.query<mysql.RowDataPacket[]>(query);

        for (const row of rows) {
            const sql = row.SQL_TEXT;
            if (!sql) continue;

            const routeMatch = sql.match(/\/\* route: (.*?) \*\//);
            if (routeMatch && routeMatch[1]) {
                const routeName = routeMatch[1].trim();
                const cleanSql = sanitizer.clean(sql);
                const queryHash = computeHash(cleanSql);
                tags.push({ queryHash, routeName });
            }
        }
    } catch (err) {
        logger.error('Error collecting tags (MySQL)', err);
    }
    return tags;
  }

  async collectMetrics(): Promise<QueryMetric[]> {
    const metrics: QueryMetric[] = [];
    try {
        // Query sys.statement_analysis or performance_schema.events_statements_summary_by_digest
        // PRD mentions: summary_by_digest
        // performance_schema.events_statements_summary_by_digest

        const query = `
            SELECT
                DIGEST_TEXT as query,
                COUNT_STAR as calls,
                AVG_TIMER_WAIT / 1000000000 as avg_latency_ms, -- TIMER_WAIT is in picoseconds usually
                SUM_ROWS_EXAMINED as rows
            FROM performance_schema.events_statements_summary_by_digest
            WHERE DIGEST_TEXT IS NOT NULL
            LIMIT 1000
        `;

        const [rows] = await this.pool.query<mysql.RowDataPacket[]>(query);

        for (const row of rows) {
             const rawQuery = row.query;
             const cleanQuery = sanitizer.clean(rawQuery);
             const queryHash = computeHash(cleanQuery);

             metrics.push({
                 queryHash,
                 queryText: cleanQuery,
                 avgLatency: parseFloat(row.avg_latency_ms),
                 callCount: parseInt(row.calls, 10),
                 rowsProcessed: parseInt(row.rows, 10)
             });
        }

    } catch (err: any) {
        logger.error('Error collecting metrics (MySQL)', err);
    }
    return metrics;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
