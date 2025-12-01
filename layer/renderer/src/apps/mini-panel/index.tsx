import type { FC } from 'react'


export const Panel: FC = () => {
  return null
  // const [dragging, setDragging] = React.useState(false)

  // const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  //   if (e.button !== 0) return
  //   ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  //   setDragging(true)
  //   ipcServices?.float.startDrag()
  // }
  // const finishDrag = () => {
  //   if (dragging) {
  //     ipcServices?.float.endDrag()
  //     setDragging(false)
  //   }
  // }

  // return (
  //   <div
  //     className={clsx(
  //       'text-white p-3 rounded-xl overflow-hidden h-[310px] w-[370px] mx-[10px] mb-[20px] shadow-xl shadow-black/50',
  //       // Simulate window look via CSS: solid bg, subtle border, heavy shadow
  //       'bg-[#141414] flex flex-col border border-white/10',
  //       'transition-all duration-200 ease-out',
  //       // visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
  //       'opacity-100 translate-y-0',
  //     )}
  //     onMouseEnter={() => window.ipcRenderer?.send('panel:hover', true)}
  //     onMouseLeave={() => {
  //       window.ipcRenderer?.send('panel:hover', false)
  //       // Request hide if pointer leaves the panel
  //       if (import.meta.env.DEV) return
  //       ipcServices?.panel.hide()
  //     }}
  //     onPointerDown={onPointerDown}
  //     onPointerUp={finishDrag}
  //     onLostPointerCapture={finishDrag}
  //   >
  //     <ActiveOrRecentList />
  //   </div>
  // )
}

// const speedPresets = [128 * 1024, 512 * 1024, 1 * 1024 * 1024, 4 * 1024 * 1024]

// const ActiveOrRecentList: FC = () => {
//   const { t } = useTranslation()
//   // Lightweight global speeds
//   const { data: transferInfo } = useAuthQuery({
//     queryKey: ['mini', 'qb', 'transfer-info'],
//     queryFn: () => QBittorrentClient.shared.requestTransferInfo(),
//     refetchInterval: 1000,
//     staleTime: 500,
//   })

//   // Active torrents
//   const { data: active } = useAuthQuery({
//     queryKey: ['mini', 'qb', 'torrents', 'active'],
//     queryFn: () =>
//       QBittorrentClient.shared.requestTorrentsInfo({
//         filter: 'active',
//         limit: 8,
//       }),
//     refetchInterval: 1000,
//     staleTime: 500,
//   })

//   const useRecent = !active || active.length === 0
//   const { data: recent } = useAuthQuery({
//     queryKey: ['mini', 'qb', 'torrents', 'recent'],
//     queryFn: () =>
//       QBittorrentClient.shared.requestTorrentsInfo({
//         sort: 'last_activity',
//         reverse: true,
//         limit: 8,
//       }),
//     refetchInterval: 5000,
//     staleTime: 1000,
//     enabled: useRecent,
//   })

//   const list = (active && active.length > 0 ? active : recent) ?? []

//   const globalDl = transferInfo?.dl_info_speed ?? 0
//   const globalUl = transferInfo?.up_info_speed ?? 0
//   const totalDl = transferInfo?.dl_info_data ?? 0
//   const totalUl = transferInfo?.up_info_data ?? 0

//   return (
//     <div className="grow flex flex-col h-0">
//       <div className="mb-2 flex items-center justify-between text-[11px] text-white/70">
//         <div className="flex items-center gap-3">
//           <span>{t('miniPanel.global')}</span>
//           <span>
//             {formatSpeed(globalDl)} <i className="i-lucide-arrow-down" />
//           </span>
//           <span>
//             {formatSpeed(globalUl)} <i className="i-lucide-arrow-up" />
//           </span>
//         </div>
//         <div className="text-white/50">
//           {t('miniPanel.total', { count: list.length })}
//         </div>
//       </div>
//       <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
//         <div className="flex items-center gap-4">
//           <span>
//             {t('miniPanel.totalDownloaded')}: {formatBytes(totalDl)}
//           </span>
//           <span>
//             {t('miniPanel.totalUploaded')}: {formatBytes(totalUl)}
//           </span>
//         </div>
//       </div>
//       <div className="mb-2 flex items-center justify-between text-[11px] text-white/80">
//         <span>
//           {active && active.length > 0
//             ? t('miniPanel.active')
//             : t('miniPanel.recent')}
//         </span>
//       </div>
//       <div className="grow h-0 relative flex flex-col min-w-0 -mb-3">
//         {list.length > 0 ? (
//           <ScrollArea
//             rootClassName="h-full flex flex-col min-w-0 -mx-3"
//             viewportClassName="px-3 pb-3"
//             flex
//           >
//             <div className="space-y-2">
//               {list.map((t) => (
//                 <Row key={t.hash} info={t} />
//               ))}
//             </div>
//           </ScrollArea>
//         ) : (
//           <div className="text-xs text-white/70">{t('miniPanel.noTasks')}</div>
//         )}
//       </div>
//     </div>
//   )
// }

// const Row: FC<{ info: Torrent }> = ({ info }) => {
//   const [menuOpen, setMenuOpen] = React.useState(false)
//   const { t } = useTranslation()
//   const paused =
//     (info.state || '').toLowerCase().includes('paused') ||
//     (info.state || '').toLowerCase().includes('stopped')

//   const togglePause = async () => {
//     try {
//       if (paused) await QBittorrentClient.shared.startTorrent(info.hash)
//       else await QBittorrentClient.shared.stopTorrent(info.hash)
//     } catch (e) {
//       console.error('toggle pause failed', e)
//     }
//   }

//   const setLimit = async (bps: number | 'unlimited') => {
//     try {
//       if (bps === 'unlimited') {
//         await QBittorrentClient.shared.setTorrentDownloadLimit(info.hash, 0)
//       } else {
//         await QBittorrentClient.shared.setTorrentDownloadLimit(info.hash, bps)
//       }
//       setMenuOpen(false)
//     } catch (e) {
//       console.error('set limit failed', e)
//     }
//   }

//   return (
//     <div className="text-[11px]">
//       <div className="truncate text-white/90 flex items-center gap-2">
//         <button
//           type="button"
//           className="no-drag-region w-4 h-4 rounded bg-white/10 hover:bg-white/20 grid place-items-center"
//           title={paused ? t('actions.resume') : t('actions.pause')}
//           onClick={togglePause}
//         >
//           {paused ? (
//             <i className="i-mingcute-play-fill" />
//           ) : (
//             <i className="i-mingcute-pause-fill" />
//           )}
//         </button>
//         <div className="flex-1 truncate">{info.name || info.hash}</div>
//         <div className="relative">
//           {menuOpen && (
//             <div className="absolute right-0 z-10 mt-1 w-28 rounded bg-[#1a1a1a] border border-white/10 shadow-lg shadow-black/40">
//               {speedPresets.map((v) => (
//                 <div
//                   key={v}
//                   className="px-2 py-1 hover:bg-white/10 cursor-pointer"
//                   onClick={() => setLimit(v)}
//                 >
//                   {formatSpeed(v)}
//                 </div>
//               ))}
//               <div
//                 className="px-2 py-1 hover:bg-white/10 cursor-pointer"
//                 onClick={() => setLimit('unlimited')}
//               >
//                 {t('addTorrent.settingsPanel.unlimited')}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//       <div className="mt-1 h-1.5 rounded bg-white/10 overflow-hidden">
//         <div
//           className="h-full bg-emerald-500"
//           style={{ width: `${Math.round((info.progress ?? 0) * 100)}%` }}
//         />
//       </div>
//       <div className="mt-1 flex items-center justify-between text-white/70">
//         <span className="flex items-center gap-1">
//           <i className="i-lucide-cloud-download" />
//           {formatSpeed(info.dlspeed || 0)}{' '}
//           <i className="i-lucide-cloud-upload" />{' '}
//           {formatSpeed(info.upspeed || 0)}{' '}
//         </span>
//         <span className="ml-2 uppercase">
//           {(info.state || '').replaceAll(/([A-Z])/g, ' $1')}
//         </span>
//       </div>
//     </div>
//   )
// }
