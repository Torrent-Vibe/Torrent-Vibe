import { m } from 'motion/react'

import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

interface DragOverlayProps {
  isDragOver: boolean
  isVisible: boolean
}

export const DragOverlay = ({ isVisible, isDragOver }: DragOverlayProps) => {
  if (!isVisible) return null

  return (
    <m.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] pointer-events-none"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={Spring.presets.snappy}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* 中央提示区域 */}
      <div className="flex items-center justify-center h-full">
        <m.div
          initial={{ scale: 0.8, y: 20 }}
          transition={Spring.presets.smooth}
          animate={{
            scale: isDragOver ? 1.05 : 1,
            y: 0,
          }}
          className={cn(
            'relative max-w-md mx-auto p-8 rounded-2xl border-2 border-dashed transition-all duration-300',
            isDragOver
              ? 'border-accent bg-accent/10 scale-105'
              : 'border-border bg-background/50 scale-100',
          )}
        >
          {/* 图标 */}
          <div className="flex justify-center mb-4">
            <m.div
              animate={{
                rotate: isDragOver ? [0, -10, 10, 0] : 0,
              }}
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300',
                isDragOver
                  ? 'bg-accent text-white'
                  : 'bg-fill text-text-secondary',
              )}
              transition={{
                duration: 0.5,
                repeat: isDragOver ? Infinity : 0,
                repeatType: 'reverse',
              }}
            >
              <i className="i-mingcute-file-download-line text-2xl" />
            </m.div>
          </div>

          {/* 文本提示 */}
          <div className="text-center space-y-2">
            <m.h3
              transition={Spring.presets.snappy}
              animate={{
                scale: isDragOver ? 1.05 : 1,
              }}
              className={cn(
                'text-lg font-semibold transition-colors duration-300',
                isDragOver ? 'text-accent' : 'text-text',
              )}
            >
              {isDragOver ? '释放以添加种子文件' : '拖拽种子文件到这里'}
            </m.h3>
            <p className="text-sm text-text-secondary">
              支持 .torrent 文件格式
            </p>
          </div>

          {/* 装饰性动画点 */}
          <div className="absolute -top-2 -left-2">
            <m.div
              className="w-4 h-4 bg-accent rounded-full"
              animate={{
                scale: isDragOver ? [1, 1.5, 1] : [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          <div className="absolute -bottom-2 -right-2">
            <m.div
              className="w-3 h-3 bg-accent/60 rounded-full"
              animate={{
                scale: isDragOver ? [1, 1.3, 1] : [1, 1.1, 1],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.5,
              }}
            />
          </div>
        </m.div>
      </div>

      {/* 边框指示器 */}
      <m.div
        animate={{
          scale: isDragOver ? [1, 1.02, 1] : 1,
        }}
        className={cn(
          'absolute inset-4 rounded-xl border-2 border-dashed transition-colors duration-300',
          isDragOver ? 'border-accent' : 'border-border/50',
        )}
        transition={{
          duration: 1.5,
          repeat: isDragOver ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />
    </m.div>
  )
}
