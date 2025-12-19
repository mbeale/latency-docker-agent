import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

const requiredEnv = ['DATABASE_URL', 'INGESTION_TOKEN'];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    logger.error(`Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  ingestionToken: process.env.INGESTION_TOKEN!,
  apiUrl: process.env.API_URL || 'https://api.your-saas.com',
  pollIntervalSec: parseInt(process.env.POLL_INTERVAL_SEC || '60', 10),
  dbType: process.env.DB_TYPE || 'postgres', // Auto-detect logic could be added, but defaulting for now
};

// Validate DB Type
if (!['postgres', 'mysql'].includes(config.dbType)) {
    logger.error(`Invalid DB_TYPE: ${config.dbType}. Must be 'postgres' or 'mysql'.`);
    process.exit(1);
}
