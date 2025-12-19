export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, meta }));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, error: error?.message || error, stack: error?.stack }));
  },
  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, meta }));
  }
};
