// What a failed plugin.request says to a person.
export function errorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'timeout'
  ) {
    return 'A operação demorou demais. Tente de novo.'
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'unavailable'
  ) {
    return 'O worker do plugin não está rodando. Confira se o plugin está habilitado e aprovado.'
  }
  return error instanceof Error ? error.message : String(error)
}
