// What a failed plugin.request says to a person.
import { errorCode } from '../domain/json-value'

export function errorMessage(error: unknown): string {
  const code = errorCode(error)
  if (code === 'timeout') {
    return 'A operação demorou demais. Tente de novo.'
  }
  if (code === 'unavailable') {
    return 'O worker do plugin não está rodando. Confira se o plugin está habilitado e aprovado.'
  }
  return error instanceof Error ? error.message : String(error)
}
