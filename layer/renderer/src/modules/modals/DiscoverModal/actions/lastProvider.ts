export const resolveLastProvider = <T extends string>(
  remembered: T | null | undefined,
  readyIds: readonly T[],
): T | null => {
  if (remembered && readyIds.includes(remembered)) {
    return remembered
  }
  return readyIds[0] ?? null
}

export const selectDiscoverProvider = <T extends string>(
  providerId: T,
  options: ReadonlyArray<{ id: T, ready: boolean }>,
): 'activate' | 'settings' => {
  const option = options.find(item => item.id === providerId)
  if (option && !option.ready) {
    return 'settings'
  }
  return 'activate'
}
