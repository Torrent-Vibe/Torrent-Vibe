import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'

import { useMobileFieldConfig } from '../hooks/use-mobile-field-config'
import { MobileFieldSelectorContent } from './MobileFieldSelectorContent'
import { BottomSheet } from './UniversalBottomSheetManager'

interface MobileFieldSelectorButtonProps {
  className?: string
}

export const MobileFieldSelectorButton = ({
  className,
}: MobileFieldSelectorButtonProps) => {
  const { visibleFields } = useMobileFieldConfig()

  const handleOpen = () => {
    BottomSheet.present(MobileFieldSelectorContent)
  }

  return (
    <Button
      aria-label="Customize cell fields"
      size="sm"
      variant="ghost"
      className={cn(
        'flex items-center gap-2 text-text-secondary hover:text-text',
        className,
      )}
      onClick={handleOpen}
    >
      <i className="i-mingcute-settings-4-line text-sm" />
      <span className="text-xs font-medium">
        Fields ({visibleFields.length})
      </span>
    </Button>
  )
}
