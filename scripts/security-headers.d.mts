// Kiểu cho scripts/security-headers.mjs (dùng trong tests/security.test.ts)
export function contentSecurityPolicy(upstream?: string): string;
export function securityHeaders(upstream?: string): { key: string; value: string }[];
