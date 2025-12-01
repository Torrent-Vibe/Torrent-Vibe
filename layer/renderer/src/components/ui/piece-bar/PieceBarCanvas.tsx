import { useEffect, useMemo, useRef } from 'react'

import { useIsDark } from '~/hooks/common'

export interface PieceBarCanvasProps {
  totalPieces?: number
  havePieces?: number
  states?: number[]
  availability?: number[]
  className?: string
  height?: number
  radius?: number
  progress?: number // Overall progress percentage (0-1)
}

function getBgColorFromClass(className: string): string {
  if (typeof document === 'undefined') return 'rgba(0,0,0,0.3)'
  const el = document.createElement('span')
  el.style.display = 'none'
  el.className = className
  document.body.append(el)
  const color = getComputedStyle(el).backgroundColor
  el.remove()
  return color || 'rgba(0,0,0,0.3)'
}

export function PieceBarCanvas({
  totalPieces,
  havePieces,
  states,
  availability,
  className,
  height = 8,
  radius = 2,
  progress,
}: PieceBarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const isDark = useIsDark()
  const { colorDone, colorPartial, colorEmpty } = useMemo(() => {
    void isDark
    return {
      colorDone: getBgColorFromClass('bg-accent/80'),
      colorPartial: getBgColorFromClass('bg-accent/40'),
      colorEmpty: getBgColorFromClass('bg-fill-quaternary'),
    }
  }, [isDark])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const drawCanvas = (width: number, canvasHeight: number) => {
      const dpr = window.devicePixelRatio || 1

      // Set canvas internal resolution
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(canvasHeight * dpr))

      // Don't set canvas style size - let CSS handle it

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Scale context to match device pixel ratio
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, canvasHeight)

      // Rounded rect background (use logical pixels now)
      const w = width
      const h = canvasHeight
      const r = Math.min(radius, h / 2)
      ctx.fillStyle = colorEmpty
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.lineTo(w - r, 0)
      ctx.quadraticCurveTo(w, 0, w, r)
      ctx.lineTo(w, h - r)
      ctx.quadraticCurveTo(w, h, w - r, h)
      ctx.lineTo(r, h)
      ctx.quadraticCurveTo(0, h, 0, h - r)
      ctx.lineTo(0, r)
      ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.closePath()
      ctx.fill()

      // If exact states are present, draw per-pixel columns; else draw a simple ratio bar
      if (states && states.length > 0) {
        // Special case: if progress is 100%, treat all pieces as downloaded
        const isCompleted = progress !== undefined && progress >= 0.999
        // Determine how many vertical columns we can draw (one per device pixel)
        const columns = Math.min(w, states.length)
        // For downsampling, map a column to a bucket of pieces and check for piece completion
        for (let x = 0; x < columns; x++) {
          const start = Math.floor((x * states.length) / columns)
          const end = Math.floor(((x + 1) * states.length) / columns)

          let downloadedCount = 0
          let downloadingCount = 0
          let totalCount = 0

          // Count piece states instead of averaging (more accurate for visual representation)
          for (let j = start; j < Math.max(end, start + 1); j++) {
            const state = states[j] ?? 0
            totalCount += 1
            if (state === 2)
              downloadedCount += 1 // Downloaded
            else if (state === 1) downloadingCount += 1 // Downloading
            // state === 0 is not downloaded (no action needed)
          }

          let col = colorEmpty

          // Special handling for completed torrents
          if (isCompleted) {
            col = colorDone
          } else {
            // Determine color based on piece completion ratio
            const completionRatio = downloadedCount / totalCount
            const partialRatio = downloadingCount / totalCount

            // If all or almost all pieces are downloaded, show as done
            if (completionRatio >= 0.8) {
              col = colorDone
            }
            // If there are any downloading pieces or some downloaded pieces, show as partial
            else if (
              partialRatio > 0 ||
              (completionRatio > 0 && completionRatio < 0.8)
            ) {
              col = colorPartial
            }
            // Otherwise, remain empty (default)
          }

          ctx.fillStyle = col
          // Draw the column using logical pixels
          ctx.fillRect(x, 0, 1, h)
        }
      } else {
        // Fallback when piece states are not available - use have/total ratio
        const have = havePieces || 0
        const total = totalPieces || 1
        const ratio = Math.max(0, Math.min(1, have / total))

        if (ratio > 0) {
          ctx.fillStyle = colorDone
          const fillWidth = Math.round(w * ratio)
          // Inset by a small padding to keep rounded edges visible
          const inset = 1
          ctx.fillRect(
            inset,
            inset,
            Math.max(0, fillWidth - inset * 2),
            h - inset * 2,
          )
        }
        // If ratio is 0, background (colorEmpty) is already drawn
      }

      // Final override: if progress is 100%, ensure the entire bar is filled
      if (progress !== undefined && progress >= 0.999) {
        ctx.fillStyle = colorDone
        const inset = 1
        ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2)
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const canvasHeight = Math.max(1, Math.floor(entry.contentRect.height))
      if (width > 0 && canvasHeight > 0) {
        drawCanvas(width, canvasHeight)
      }
    })

    resizeObserver.observe(canvas)

    // Initial draw
    const rect = canvas.getBoundingClientRect()
    const initialWidth = rect.width
    const initialHeight = rect.height
    if (initialWidth > 0 && initialHeight > 0) {
      drawCanvas(initialWidth, initialHeight)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [
    height,
    states,
    havePieces,
    totalPieces,
    availability,
    colorDone,
    colorPartial,
    colorEmpty,
    radius,
    progress,
  ])

  return (
    <div className={className} style={{ height }}>
      <canvas className="w-full h-full" ref={canvasRef} />
    </div>
  )
}
