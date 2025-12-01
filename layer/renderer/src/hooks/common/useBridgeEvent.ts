import type { BridgeEventData, BridgeEventName } from '@torrent-vibe/main'
import { useEffect } from 'react'
import { useEventCallback } from 'usehooks-ts'

export const useBridgeEvent = <T extends BridgeEventName>(
  eventName: T,
  listener: (data: BridgeEventData<T>) => void,
): void => {
  const eventListen = useEventCallback(listener)
  useEffect(() => {
    const handler = (_: unknown, data: BridgeEventData<T>) => {
      eventListen(data)
    }
    const ipc = window.ipcRenderer
    ipc?.on(eventName, handler)
    return () => {
      ipc?.removeListener(eventName, handler)
    }
  }, [eventName, eventListen])
}
