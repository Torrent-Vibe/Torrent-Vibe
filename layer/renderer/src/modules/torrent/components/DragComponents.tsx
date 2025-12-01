import { m } from 'motion/react'
import * as React from 'react'

import { Spring } from '~/lib/spring'

export interface DragPreviewProps {
  columnId: string
  children: React.ReactNode
}

export const DragPreview: React.FC<DragPreviewProps> = ({ children }) => {
  return (
    <m.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 1.05, rotate: 2 }}
      transition={Spring.presets.snappy}
      className="bg-material-medium border border-accent/50 rounded-lg px-3 py-2 text-text shadow-2xl backdrop-blur-sm relative"
      style={{
        minWidth: '120px',
        maxWidth: '200px',
        boxShadow:
          '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 20px 25px -5px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-accent-secondary/20 rounded-lg" />
      <div className="relative z-10 font-medium">{children}</div>
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
    </m.div>
  )
}
