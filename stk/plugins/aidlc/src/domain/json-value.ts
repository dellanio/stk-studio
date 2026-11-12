// Narrowing for JSON and error values read from outside (files, HTTP, storage).

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function errorCode(error: unknown): unknown {
  return isRecord(error) ? error.code : undefined
}
