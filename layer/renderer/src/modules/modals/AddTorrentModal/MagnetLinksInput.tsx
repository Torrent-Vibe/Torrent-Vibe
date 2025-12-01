import { useTranslation } from 'react-i18next'

import { Textarea } from '~/components/ui/input/Textarea'

import { getMagnetLinks } from './shared/get-magnet-links'
import type { TorrentFormData, TorrentFormHandlers } from './types'

interface MagnetLinksInputProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
}

export const MagnetLinksInput = ({
  formData,
  handlers,
}: MagnetLinksInputProps) => {
  const { t } = useTranslation()

  const magnetLinks = getMagnetLinks(formData.magnetLinks)

  const validMagnetCount = magnetLinks.length
  const hasSingleMagnet = validMagnetCount === 1
  const { previewState } = handlers
  const isMagnetPreview = previewState.source === 'magnet'
  const isReady = isMagnetPreview && previewState.status === 'ready'
  const isError = isMagnetPreview && previewState.status === 'error'

  return (
    <div className="space-y-2 grow flex flex-col">
      <Textarea
        id="magnet-links"
        placeholder="Enter one or more magnet links (one per line):&#10;magnet:?xt=urn:btih:...&#10;magnet:?xt=urn:btih:..."
        value={formData.magnetLinks}
        onChange={(e) =>
          handlers.setFormData((prev) => ({
            ...prev,
            magnetLinks: e.target.value,
          }))
        }
        className="font-mono -mt-3 text-sm min-h-[180px] resize-none h-0 grow"
        rows={6}
      />

      <div className="flex flex-col gap-1">
        {!hasSingleMagnet && validMagnetCount > 1 && (
          <p className="text-xs text-red">
            {t('addTorrent.preview.magnetMultiple')}
          </p>
        )}

        {/* {!hasSingleMagnet && validMagnetCount === 0 && (
          <p className="text-xs text-text-secondary">
            {t('addTorrent.preview.magnetHint')}
          </p>
        )} */}

        {isReady && (
          <p className="text-xs text-green">
            {t('addTorrent.preview.magnetLoaded', {
              name: previewState.name || previewState.displayName || '',
            })}
          </p>
        )}

        {isError && previewState.error && (
          <p className="text-xs text-red">{previewState.error}</p>
        )}
      </div>
    </div>
  )
}
