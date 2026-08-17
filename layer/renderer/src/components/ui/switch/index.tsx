'use client'

import * as SwitchPrimitives from '@radix-ui/react-switch'
import type { HTMLMotionProps } from 'motion/react'
import { m as motion } from 'motion/react'
import * as React from 'react'

import { cn } from '~/lib/cn'

type SwitchProps = React.ComponentProps<typeof SwitchPrimitives.Root> &
  HTMLMotionProps<'button'> & {
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    thumbIcon?: React.ReactNode
  }

function Switch({
  className,
  leftIcon,
  rightIcon,
  thumbIcon,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const [isChecked, setIsChecked] = React.useState(
    props?.checked ?? props?.defaultChecked ?? false,
  )
  const [isTapped, setIsTapped] = React.useState(false)

  React.useEffect(() => {
    if (props?.checked !== undefined) setIsChecked(props.checked)
  }, [props?.checked])

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      setIsChecked(checked)
      onCheckedChange?.(checked)
    },
    [onCheckedChange],
  )
  // Avoid motion layout animations; use explicit transform animation instead
  const TRACK_WIDTH = 40 // w-10 => 2.5rem => 40px
  const TRACK_PADDING = 3 // p-[3px]
  const THUMB_SIZE = 18
  const CHECKED_X = TRACK_WIDTH - TRACK_PADDING * 2 - THUMB_SIZE
  return (
    <SwitchPrimitives.Root
      {...props}
      asChild
      onCheckedChange={handleCheckedChange}
    >
      <motion.button
        data-slot="switch"
        initial={false}
        whileTap="tap"
        className={cn(
          'relative flex p-[3px] h-6 w-10 shrink-0 cursor-switch items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=unchecked]:bg-fill-secondary justify-start',
          className,
        )}
        onTap={() => setIsTapped(false)}
        onTapCancel={() => setIsTapped(false)}
        onTapStart={() => setIsTapped(true)}
        {...props}
      >
        {leftIcon && (
          <motion.div
            className="absolute [&_svg]:size-3 left-1 top-1/2 -translate-y-1/2 text-text-secondary"
            data-slot="switch-left-icon"
            transition={{ type: 'spring', bounce: 0 }}
            animate={
              isChecked ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }
            }
          >
            {typeof leftIcon !== 'string' ? leftIcon : null}
          </motion.div>
        )}

        {rightIcon && (
          <motion.div
            className="absolute [&_svg]:size-3 right-1 top-1/2 -translate-y-1/2 text-text-secondary"
            data-slot="switch-right-icon"
            transition={{ type: 'spring', bounce: 0 }}
            animate={
              isChecked ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }
            }
          >
            {typeof rightIcon !== 'string' ? rightIcon : null}
          </motion.div>
        )}

        <SwitchPrimitives.Thumb asChild>
          <motion.div
            initial
            data-slot="switch-thumb"
            whileTap="tab"
            animate={{
              x: isChecked ? CHECKED_X : 0,
              width: isTapped ? 21 : THUMB_SIZE,
            }}
            className={
              'relative z-[1] [&_svg]:size-3 flex items-center justify-center rounded-full bg-background shadow-lg ring-0 text-text-secondary'
            }
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
            }}
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 25 },
              width: { duration: 0.1 },
            }}
          >
            {thumbIcon && typeof thumbIcon !== 'string' ? thumbIcon : null}
          </motion.div>
        </SwitchPrimitives.Thumb>
      </motion.button>
    </SwitchPrimitives.Root>
  )
}

export { Switch, type SwitchProps }
