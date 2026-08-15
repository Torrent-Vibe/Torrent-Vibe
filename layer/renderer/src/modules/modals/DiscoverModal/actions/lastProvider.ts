export const resolveLastProvider = <T extends string>(
  remembered: T | null | undefined,
  readyIds: readonly T[],
): T | null => {
  if (remembered && readyIds.includes(remembered)) {
    return remembered
  }
  return readyIds[0] ?? null
}
