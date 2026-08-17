import type { LicenseStats } from './types'

interface LicenseStatsSectionProps {
  commandLabel?: string
  licenseStats: LicenseStats[]
  totalDependencies: number
}

export const LicenseStatsSection: React.FC<LicenseStatsSectionProps> = ({
  totalDependencies,
  licenseStats,
  commandLabel = 'torrent-vibe --licenses',
}) => {
  return (
    <div className="font-mono text-sm">
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-accent">$</span>
        <span className="text-accent">{commandLabel}</span>
      </div>

      <div className="space-y-1 mb-4">
        <div className="text-text">
          Total open source dependencies:{' '}
          <span className="text-accent font-medium">{totalDependencies}</span>
        </div>
        <div className="text-text-secondary">License distribution:</div>
        {licenseStats.map(({ license, count, percentage }) => (
          <div className="ml-2 text-text" key={license}>
            <span className="text-text-secondary">{license}:</span>
            <span className="ml-4">
              {count} packages ({percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
