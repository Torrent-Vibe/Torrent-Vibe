import { useEffect, useRef } from 'react'

import { Prompt } from '~/components/ui/prompts'
import { presentAddTorrentModal } from '~/modules/modals/AddTorrentModal/utils'

/**
 * Electron-only hook: when the window gains focus, read clipboard text and
 * if magnet links are found, open the Add Torrent modal prefilled with them.
 */
export const useMagnetClipboardOnFocus = () => {
  const lastHandled = useRef<string | null>(null)

  useEffect(() => {
    if (!ELECTRON) return

    const extractMagnets = (text: string): string[] => {
      if (!text) return []
      const matches = text.match(/magnet:\S+/gi) || []
      // Deduplicate while preserving order
      const seen = new Set<string>()
      const result: string[] = []
      for (const m of matches) {
        if (!seen.has(m)) {
          seen.add(m)
          result.push(m)
        }
      }
      return result
    }

    const onFocus = async () => {
      try {
        const txt = (await navigator.clipboard?.readText?.()) || ''
        const magnets = extractMagnets(txt)
        if (magnets.length === 0) return

        const payload = magnets.join('\n')
        if (lastHandled.current === payload) return

        Prompt.prompt({
          title: 'Detected magnet links from clipboard',
          description: `Add these magnet links to the library?`,
          content: (
            <pre className="text-sm text-text-secondary overflow-auto font-mono whitespace-pre-wrap max-h-[200px] w-full break-all">
              {payload}
            </pre>
          ),
          onConfirm: () => {
            presentAddTorrentModal({ initialMagnetLinks: payload })
          },
        })

        lastHandled.current = payload
      } catch {
        // Ignore clipboard read errors silently
      }
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])
}
