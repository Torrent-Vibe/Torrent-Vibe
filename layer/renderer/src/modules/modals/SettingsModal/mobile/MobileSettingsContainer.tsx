import * as React from 'react'

import { MobileSettingsLayout } from './MobileSettingsLayout'

interface MobileSettingsContainerProps {
  onClose?: () => void
  className?: string
  initialTab?: import('../configs').SettingsSection
}

export const MobileSettingsContainer: React.FC<
  MobileSettingsContainerProps
> = ({ onClose, className, initialTab }) => {
  return (
    <MobileSettingsLayout
      onClose={onClose}
      className={className}
      initialTab={initialTab}
    />
  )
}

// Export for external usage
export default MobileSettingsContainer
