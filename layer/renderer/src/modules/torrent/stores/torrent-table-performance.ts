const SCROLL_ACTIVITY_GRACE_MS = 500

let scrollActiveUntil = 0

export const markTorrentTableScrollActive = () => {
  scrollActiveUntil = performance.now() + SCROLL_ACTIVITY_GRACE_MS
}

export const isTorrentTableScrollActive = () =>
  performance.now() < scrollActiveUntil
