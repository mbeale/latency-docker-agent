import axios from 'axios';
import axiosRetry from 'axios-retry';
import { config } from './config';
import { logger } from './utils/logger';
import { Collector, SqlTag, QueryMetric } from './collectors/interface';
import { PostgresCollector } from './collectors/postgres';
import { MysqlCollector } from './collectors/mysql';

// LRU Cache for Route Names (simple implementation)
const routeCache = new Map<string, string>(); // queryHash -> routeName
const CACHE_LIMIT = 10000;

function updateCache(tags: SqlTag[]) {
  for (const tag of tags) {
    routeCache.set(tag.queryHash, tag.routeName);
  }
  // Simple eviction
  if (routeCache.size > CACHE_LIMIT) {
    const keysToDelete = Array.from(routeCache.keys()).slice(0, routeCache.size - CACHE_LIMIT);
    for (const key of keysToDelete) {
      routeCache.delete(key);
    }
  }
}

// Configure axios retry
axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ? error.response.status >= 500 : false);
    }
});

async function startAgent() {
  // Log config safely (exclude sensitive data)
  const safeConfig = { ...config, databaseUrl: '***', ingestionToken: '***' };
  logger.info('Starting DB Latency Tracker Agent', { config: safeConfig });

  let collector: Collector;
  if (config.dbType === 'postgres') {
    collector = new PostgresCollector();
  } else {
    collector = new MysqlCollector();
  }

  await collector.init();

  // Loop A: Tag Sniffer
  const runTagSniffer = async () => {
    try {
      const tags = await collector.collectTags();
      if (tags.length > 0) {
        updateCache(tags);
      }
    } catch (err) {
      logger.error('Error in Tag Sniffer loop', err);
    }
    setTimeout(runTagSniffer, 1000);
  };
  // Start the loop
  runTagSniffer();


  // Loop B: Metrics Reporter
  const runMetricsReporter = async () => {
    try {
      const metrics = await collector.collectMetrics();
      if (metrics.length > 0) {
          const payload = {
            timestamp: new Date().toISOString(),
            agent_version: '1.0.0', // Could come from package.json
            db_type: config.dbType,
            metrics: metrics.map(m => ({
              query_hash: m.queryHash,
              query_text: m.queryText,
              route_name: routeCache.get(m.queryHash), // Enrich from cache
              avg_latency: m.avgLatency,
              call_count: m.callCount,
              rows_processed: m.rowsProcessed
            }))
          };

          try {
            await axios.post(`${config.apiUrl}/ingest`, payload, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ingestionToken}`
              },
              timeout: 5000
            });
            logger.info(`Sent ${metrics.length} metrics to ingestion API`);
          } catch (err: any) {
             logger.warn(`Ingestion API unavailable, dropping metrics. ${err.message}`);
          }
      }
    } catch (err) {
      logger.error('Error in Metrics Reporter loop', err);
    }
    setTimeout(runMetricsReporter, config.pollIntervalSec * 1000);
  };
  // Start the loop
  runMetricsReporter();

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down agent...');
    await collector.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startAgent().catch(err => {
  logger.error('Fatal error starting agent', err);
  process.exit(1);
});
