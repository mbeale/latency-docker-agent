export const sanitizer = {
  clean: (sql: string): string => {
    if (!sql) return '';

    // Replace single quoted strings (careful with escaped quotes)
    // The regex '(?:\\[\s\S]|[^'])*' matches a single quoted string where quotes can be escaped or doubled.
    // The PRD suggests: /'(?:[^']|'')*'/g which handles 'O''Neil' style escaping in SQL.
    let cleaned = sql.replace(/'(?:[^']|'')*'/g, '?');

    // Replace numbers (integer or float)
    cleaned = cleaned.replace(/\b\d+(\.\d+)?\b/g, '?');

    // Collapse multiple spaces/newlines
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }
};
