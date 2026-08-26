const MAX_TEXT_CHARS = 4_000

const toolText = (result: unknown): string | undefined => {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    return undefined
  }
  const content = (
    result as { content?: Array<{ text?: string; type?: string }> }
  ).content
  const text = content
    ?.filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim()
  return text || undefined
}

const truncateText = (text: string): string =>
  text.length > MAX_TEXT_CHARS
    ? `${text.slice(0, MAX_TEXT_CHARS)}\n...[truncated]`
    : text

export const summarizeToolResult = (result: unknown): string | undefined => {
  const text = toolText(result)
  if (!text) {
    return undefined
  }
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

export const extractActivityPayload = (result: unknown): unknown => {
  const text = toolText(result)
  if (text) {
    try {
      return JSON.parse(text)
    } catch {
      return { output: truncateText(text) }
    }
  }

  if (!result || typeof result !== 'object' || !('details' in result)) {
    return undefined
  }
  const details = (result as { details?: unknown }).details
  if (
    details &&
    typeof details === 'object' &&
    Object.keys(details as object).length > 0
  ) {
    return details
  }
  return undefined
}
