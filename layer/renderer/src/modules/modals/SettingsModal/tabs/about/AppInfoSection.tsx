import type { AppInfo, AppInfoItem } from './types'

interface AppInfoSectionProps {
  appInfo: AppInfo
}

export const AppInfoSection: React.FC<AppInfoSectionProps> = ({ appInfo }) => {
  const appInfoItems: AppInfoItem[] = [
    { label: 'Name', value: appInfo.name, isCommand: true },
    { label: 'Description', value: appInfo.description },
    { label: 'Author', value: appInfo.author },
    { label: 'Platform', value: appInfo.platform },
  ]

  return (
    <div className="space-y-2 mb-6 font-mono text-sm">
      {appInfoItems.map(({ label, value, isCommand }) => (
        <div key={label} className="flex">
          <span className="text-text-secondary w-64 shrink-0">{label}:</span>
          <span className={isCommand ? 'text-accent font-medium' : 'text-text'}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
