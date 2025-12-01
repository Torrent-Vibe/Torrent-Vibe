import type { DependencyInfo } from './types'

interface DependenciesSectionProps {
  dependencies: DependencyInfo[]
  commandLabel?: string
}

export const DependenciesSection: React.FC<DependenciesSectionProps> = ({
  dependencies,
  commandLabel = 'npm list --dependencies',
}) => {
  return (
    <div className="font-mono text-sm mb-6">
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-accent">$</span>
        <span className="text-accent">{commandLabel}</span>
      </div>

      <div className="text-text-secondary mb-2">
        Dependencies used in this proprietary application:
      </div>

      <div className="space-y-1 mb-4">
        {dependencies.map((dep, index) => (
          <div key={dep.name} className="flex items-center">
            <span className="text-text-secondary mr-2">
              {index === dependencies.length - 1 ? '└──' : '├──'}
            </span>
            <span className="text-text flex-1">
              {dep.name}@{dep.version}
            </span>
            <span className="text-text-secondary ml-4">{dep.license}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
