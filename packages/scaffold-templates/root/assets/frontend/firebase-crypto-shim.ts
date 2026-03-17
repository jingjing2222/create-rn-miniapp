function fillRandomValues(target: Uint8Array): Uint8Array {
  const cryptoObject = globalThis.crypto

  if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
    return cryptoObject.getRandomValues(target)
  }

  for (let index = 0; index < target.length; index += 1) {
    target[index] = Math.floor(Math.random() * 256)
  }

  return target
}

export function getRandomValues<T extends ArrayBufferView | null>(typedArray: T): T {
  if (typedArray === null) {
    return typedArray
  }

  const target = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
  fillRandomValues(target)

  return typedArray
}

export function randomBytes(size: number): Uint8Array {
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError('[crypto shim] randomBytes size must be a non-negative integer.')
  }

  return fillRandomValues(new Uint8Array(size))
}

export function randomFillSync<T extends ArrayBufferView>(buffer: T): T {
  const target = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  fillRandomValues(target)

  return buffer
}

export function randomUUID(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = randomBytes(16)

  const versionByte = bytes[6] ?? 0
  const variantByte = bytes[8] ?? 0

  bytes[6] = (versionByte & 0x0f) | 0x40
  bytes[8] = (variantByte & 0x3f) | 0x80

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const webcrypto = {
  getRandomValues,
  randomUUID,
  subtle: globalThis.crypto?.subtle,
}

const cryptoShim = {
  getRandomValues,
  randomBytes,
  randomFillSync,
  randomUUID,
  webcrypto,
}

export default cryptoShim
