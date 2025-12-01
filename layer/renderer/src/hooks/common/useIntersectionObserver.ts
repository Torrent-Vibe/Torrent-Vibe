import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseIntersectionObserverInit extends IntersectionObserverInit {
  freezeOnceVisible?: boolean
}

export const useIntersectionObserver = <T extends Element>(
  options?: UseIntersectionObserverInit,
) => {
  const nodeRef = useRef<T | null>(null)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)

  const setNode = useCallback((node: T | null) => {
    nodeRef.current = node
  }, [])

  const freezeOnceVisible = options?.freezeOnceVisible ?? false
  const root = options?.root ?? null
  const rootMargin = options?.rootMargin
  const thresholdMemo = useMemo(
    () => options?.threshold ?? 0,
    [options?.threshold],
  )

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (entry?.isIntersecting && freezeOnceVisible) {
      return
    }

    const observer = new IntersectionObserver(
      ([nextEntry]) => {
        setEntry(nextEntry)
      },
      {
        root,
        rootMargin,
        threshold: thresholdMemo,
      },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [
    entry?.isIntersecting,
    freezeOnceVisible,
    root,
    rootMargin,
    thresholdMemo,
  ])

  return {
    ref: setNode,
    entry,
    inView: entry?.isIntersecting ?? false,
  }
}
