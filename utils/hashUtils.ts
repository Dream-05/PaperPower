export function createHash(input: string): number {
  let hash = 0
  
  if (input.length === 0) {
    return hash
  }
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  return Math.abs(hash)
}

export function createHashHex(input: string): string {
  const hash = createHash(input)
  return hash.toString(16).padStart(8, '0')
}

export function createHashString(input: string, length: number = 16): string {
  let result = ''
  let currentInput = input
  
  while (result.length < length) {
    const hash = createHash(currentInput)
    result += Math.abs(hash).toString(36)
    currentInput = `${currentInput}:${result.length}`
  }
  
  return result.substring(0, length)
}

export function hashObject(obj: unknown): number {
  const jsonString = JSON.stringify(obj, Object.keys(obj as object).sort())
  return createHash(jsonString)
}

export function verifyDeterminism<T>(
  fn: () => T,
  iterations: number = 100
): { deterministic: boolean; results: T[] } {
  const results: T[] = []
  
  for (let i = 0; i < iterations; i++) {
    results.push(fn())
  }
  
  const firstResult = results[0]
  const deterministic = results.every(r => 
    JSON.stringify(r) === JSON.stringify(firstResult)
  )
  
  return { deterministic, results }
}
