export const sanitizePowensConnectionId = (value: string | number) => {
  return String(value).trim().replace(/^"+|"+$/g, '').trim()
}
