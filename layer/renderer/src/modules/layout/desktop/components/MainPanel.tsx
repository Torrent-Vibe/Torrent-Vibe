import { cn } from '~/lib/cn'

import type { MainPanelProps } from '../../types'

export const MainPanel = ({
  className,
  children,
  style,
}: MainPanelProps & { style?: React.CSSProperties }) => {
  return (
    <main
      className={cn(
        'flex flex-1 basis-0 flex-col bg-background min-w-[400px] overflow-hidden',
        className,
      )}
      style={style}
    >
      {children}
    </main>
  )
}
