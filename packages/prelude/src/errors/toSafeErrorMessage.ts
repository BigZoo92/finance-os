const truncateMessage = (message: string, maxLength = 2_000) => {
  return message.length > maxLength ? message.slice(0, maxLength) : message
}

export const toSafeErrorMessage = (value: unknown, fallbackMessage?: string) => {
  if (value instanceof Error) {
    return truncateMessage(value.message)
  }

  if (fallbackMessage) {
    return fallbackMessage
  }

  return truncateMessage(String(value))
}
