import { useEffect, useRef } from 'react'

const titleTemplate = `%s | Torrent Vibe`
export const useTitle = (title?: Nullable<string>) => {
  const currentTitleRef = useRef(document.title)
  useEffect(() => {
    if (!title) return

    document.title = titleTemplate.replace('%s', title)
    return () => {
      document.title = currentTitleRef.current
    }
  }, [title])
}
