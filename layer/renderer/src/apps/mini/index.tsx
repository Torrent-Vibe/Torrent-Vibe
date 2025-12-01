import type { FC } from 'react'


// Bubble-only renderer; hover shows a separate bottom panel via IPC

// const useMiniTransferMetric = () => {
//   const peakDlRef = useRef(1024 * 1024)
//   const peakUpRef = useRef(512 * 1024)

//   const { data } = useAuthQuery({
//     queryKey: ['mini', 'qb', 'transfer-info'],
//     queryFn: () => QBittorrentClient.shared.requestTransferInfo(),
//     refetchInterval: 1000,
//     staleTime: 500,
//   })
//   const dlSpeed = data?.dl_info_speed ?? 0
//   const dlLimit = data?.dl_rate_limit ?? 0
//   const upSpeed = data?.up_info_speed ?? 0
//   const upLimit = data?.up_rate_limit ?? 0

//   if (dlLimit <= 0 && dlSpeed > peakDlRef.current) peakDlRef.current = dlSpeed
//   if (upLimit <= 0 && upSpeed > peakUpRef.current) peakUpRef.current = upSpeed

//   // Choose the larger to display
//   const showDirection: 'down' | 'up' = dlSpeed >= upSpeed ? 'down' : 'up'
//   const showSpeed = showDirection === 'down' ? dlSpeed : upSpeed
//   const showLimit = showDirection === 'down' ? dlLimit : upLimit
//   const peak = showDirection === 'down' ? peakDlRef.current : peakUpRef.current
//   const denom = showLimit > 0 ? showLimit : Math.max(peak, 1)
//   const ratio = Math.max(0, Math.min(1, denom > 0 ? showSpeed / denom : 0))
//   return {
//     dlSpeed,
//     dlLimit,
//     upSpeed,
//     upLimit,
//     showDirection,
//     showSpeed,
//     showLimit,
//     ratio,
//   }
// }

export const Component: FC = () => {
  // const { showDirection, showSpeed } = useMiniTransferMetric()
  // const [orientation, setOrientation] = React.useState<
  //   'left' | 'right' | 'top'
  // >('right')
  // React.useEffect(() => {
  //   const handler = (_: any, dir: 'left' | 'right' | 'top') =>
  //     setOrientation(dir)
  //   window.ipcRenderer?.on('float:orientation', handler)
  //   return () => {
  //     window.ipcRenderer?.removeListener('float:orientation', handler)
  //   }
  // }, [])
  // const label = formatSpeed(showSpeed)
  // const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // const onEnter = () => {
  //   if (collapseTimer.current) {
  //     clearTimeout(collapseTimer.current)
  //     collapseTimer.current = null
  //   }
  //   if (mouseDownRef.current) return
  //   ipcServices?.panel.show()
  // }
  // const onLeave = () => {
  //   if (collapseTimer.current) clearTimeout(collapseTimer.current)
  //   collapseTimer.current = setTimeout(() => {
  //     // Ask main to hide; it will check if cursor is inside panel and ignore if so
  //     ipcServices?.panel.hide()
  //     collapseTimer.current = null
  //   }, 200)
  // }
  // const mouseDownRef = useRef(false)
  // const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  //   if (e.button !== 0) return
  //   ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  //   mouseDownRef.current = true
  //   ipcServices?.float.hidePanelWindow()
  //   nextFrame(() => {
  //     ipcServices?.float.startDrag()
  //   })
  // }
  // const finishDrag = () => {
  //   if (mouseDownRef.current) {
  //     ipcServices?.float.endDrag()
  //     mouseDownRef.current = false
  //   }
  // }
  // const openMainWindow = () => {
  //   ipcServices?.window.showMainWindow()
  //   ipcServices?.float.hidePanelWindow()
  //   ipcServices?.float.hide()
  // }
  // return (
  //   <div
  //     onMouseEnter={onEnter}
  //     onMouseLeave={onLeave}
  //     onPointerDown={onPointerDown}
  //     onPointerUp={finishDrag}
  //     onDoubleClick={openMainWindow}
  //     onLostPointerCapture={finishDrag}
  //     className={clsx(
  //       'pointer-events-auto text-white select-none overflow-hidden rounded-full relative',
  //       // Simulate window shadow via CSS
  //       'bg-material-ultra-thick size-[80px] relative border border-border',
  //       orientation === 'top'
  //         ? 'flex flex-col items-stretch'
  //         : 'flex items-center',
  //       // do NOT use app-region; we implement custom dragging
  //     )}
  //   >
  //     <div className={'relative size-full'}>
  //       <div className="absolute inset-0 m-auto min-w-8 gap-1 px-1 text-black text-xs font-medium flex flex-col justify-center items-center">
  //         {showDirection === 'down' ? (
  //           <i className="i-lucide-cloud-download size-4" />
  //         ) : (
  //           <i className="i-lucide-cloud-upload size-4" />
  //         )}
  //         {label}
  //       </div>
  //     </div>
  //   </div>
  // )
  return null
}

export default Component
