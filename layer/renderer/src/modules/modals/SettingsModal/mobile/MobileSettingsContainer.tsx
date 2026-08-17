import * as React from 'react'

import { MobileSettingsLayout } from './MobileSettingsLayout'

interface MobileSettingsContainerProps {
  className?: string
  initialTab?: import('../configs').SettingsSection
  onClose?: () => void
}

export const MobileSettingsContainer: React.FC<
  MobileSettingsContainerProps
> = ({ onClose, className, initialTab }) => {
  return (
    <MobileSettingsLayout
      className={className}
      initialTab={initialTab}
      onClose={onClose}
    />
  )
}

// Export for external usage
export default MobileSettingsContainer
