import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'

interface DiscoverEmptyStateProps {
  icon: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export const DiscoverEmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: DiscoverEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center text-text-secondary">
      <i className={cn(icon, 'text-3xl text-text-tertiary')} />
      <div className="max-w-md space-y-0.5">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
