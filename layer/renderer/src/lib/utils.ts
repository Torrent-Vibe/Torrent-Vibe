export function combineCleanupFunctions(
  ...fns: Array<Nullable<(() => void) | void>>
) {
  return () => {
    fns.forEach((fn) => {
      if (typeof fn === 'function') {
        fn()
      }
    })
  }
}
