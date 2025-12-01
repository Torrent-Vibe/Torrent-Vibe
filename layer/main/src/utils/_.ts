export const isHttpLike = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://')
}
