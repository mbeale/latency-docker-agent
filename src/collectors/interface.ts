export interface SqlTag {
  queryHash: string;
  routeName: string;
}

export interface QueryMetric {
  queryHash: string;
  queryText: string;
  routeName?: string;
  avgLatency: number;
  callCount: number;
  rowsProcessed: number;
}

export interface Collector {
  init(): Promise<void>;
  collectTags(): Promise<SqlTag[]>;
  collectMetrics(): Promise<QueryMetric[]>;
  close(): Promise<void>;
}
