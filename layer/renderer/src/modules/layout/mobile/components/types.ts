import type { FC } from 'react'

export type BottomSheetComponentProps = {
  bottomSheetId: string
  dismiss: () => void
}

export type BottomSheetComponent<P = unknown> = FC<
  BottomSheetComponentProps & P
> & {
  contentClassName?: string
  // Additional bottom sheet specific properties could be added here
}

export type BottomSheetContentConfig = {
  className?: string
  maxHeight?: string
  minHeight?: string
}

export type BottomSheetItem = {
  id: string
  component: BottomSheetComponent<any>
  props?: unknown
  contentConfig?: BottomSheetContentConfig
}
