export const decodePowensCode = (code: string) => {
  const normalized = code.replaceAll(' ', '+')

  try {
    return decodeURIComponent(normalized)
  } catch {
    return normalized
  }
}
