import { isMacOS } from '~/constants/os'

import { MacOSHeader } from './MacOSHeader'
import { StandardHeader } from './StandardHeader'

interface HeaderProps {
  className?: string
  showSearch?: boolean
}

export const Header = ({ className, showSearch = true }: HeaderProps) => {
  // Check if we're in Electron on macOS for traffic light buttons
  const isMacOSElectron = ELECTRON && isMacOS

  // Use platform-specific header implementation
  if (isMacOSElectron) {
    return <MacOSHeader className={className} showSearch={showSearch} />
  }

  return <StandardHeader className={className} showSearch={showSearch} />
}
