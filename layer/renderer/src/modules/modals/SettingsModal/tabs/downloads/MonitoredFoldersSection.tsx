import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

interface MonitoredFoldersSectionProps {
  prefs: Partial<Preferences>
}

export const MonitoredFoldersSection = ({
  prefs,
}: MonitoredFoldersSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold border-b border-border pb-2">
        {t('downloads.folders.title')}
      </h3>

      <div className="space-y-3">
        <div className="text-sm text-text-secondary">
          {t('downloads.folders.description')}
        </div>

        {Object.keys(prefs.scan_dirs || {}).length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t('downloads.folders.monitored')}
            </div>
            {Object.entries(prefs.scan_dirs || {}).map(([folder, action]) => (
              <div
                key={folder}
                className="flex items-center gap-2 text-sm p-2 bg-fill/5 rounded"
              >
                <span className="flex-1">{folder}</span>
                <span className="text-text-secondary">
                  {action === 0
                    ? t('downloads.folders.downloadToMonitored')
                    : action === 1
                      ? t('downloads.folders.downloadToDefault')
                      : t('downloads.folders.downloadTo', { path: action })}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-text-secondary">
          {t('downloads.folders.configNote')}
        </div>
      </div>
    </div>
  )
}
