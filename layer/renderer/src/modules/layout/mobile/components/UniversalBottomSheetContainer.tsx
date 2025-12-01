import { useAtomValue } from 'jotai'
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useEventCallback } from 'usehooks-ts'
import { Drawer } from 'vaul'

import { cn } from '~/lib/cn'
import { jotaiStore } from '~/lib/jotai'

import type { BottomSheetComponent,BottomSheetItem  } from './types'
import {
  BottomSheet,
  bottomSheetItemsAtom,
} from './UniversalBottomSheetManager'

export const UniversalBottomSheetContainer = () => {
  const items = useAtomValue(bottomSheetItemsAtom)

  return (
    <div id="global-bottomsheet-container">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <BottomSheetWrapper key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}

const BottomSheetWrapper = ({ item }: { item: BottomSheetItem }) => {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    BottomSheet.__registerCloser(item.id, () => setOpen(false))
    return () => {
      BottomSheet.__unregisterCloser(item.id)
    }
  }, [item.id])

  const dismiss = useMemo(
    () => () => {
      setOpen(false)
    },
    [],
  )

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) {
      // When closing, trigger the animation complete after a delay
      setTimeout(handleAnimationComplete, 300) // Assuming 300ms animation duration
    }
  }

  // After exit animation, remove from store
  const handleAnimationComplete = useEventCallback(() => {
    if (!open) {
      const items = jotaiStore.get(bottomSheetItemsAtom)
      jotaiStore.set(
        bottomSheetItemsAtom,
        items.filter((i) => i.id !== item.id),
      )
    }
  })

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const Component = item.component as BottomSheetComponent<any>

  const { contentClassName } = Component
  const {
    className: configClassName,
    maxHeight,
    minHeight,
  } = item.contentConfig || {}

  return (
    <Drawer.Root
      open={open}
      onOpenChange={handleOpenChange}
      shouldScaleBackground
      modal={true}
    >
      <Drawer.Portal>
        {/* Overlay */}
        <Drawer.Overlay
          className={cn(
            'fixed inset-0 bg-black/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'z-50',
          )}
        />

        {/* Bottom Sheet Content */}
        <Drawer.Content
          className={cn(
            'bg-background flex flex-col fixed bottom-0 left-0 right-0 z-50',
            'rounded-t-xl border-t border-border',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-0',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-0',
            maxHeight || 'max-h-[90vh]',
            minHeight || 'min-h-[50vh]',
            contentClassName,
            configClassName,
          )}
        >
          {/* Drag Handle */}
          <div className="flex justify-center py-3">
            <Drawer.Handle
              className={cn(
                'w-12 h-1.5 rounded-full bg-border',
                'hover:bg-border-hover transition-colors duration-150',
                'cursor-grab active:cursor-grabbing',
              )}
            />
          </div>

          {/* Component Content */}
          <div className="flex flex-col flex-1 min-h-0">
            <Component
              bottomSheetId={item.id}
              dismiss={dismiss}
              {...(item.props as any)}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
