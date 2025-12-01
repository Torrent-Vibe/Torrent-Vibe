export const getMagnetLinks = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('magnet:'))
