import type { TorrentContentPreviewState } from '../types'

export const getPreviewFileMetrics = (state: TorrentContentPreviewState) => {
  const totalFiles = state.files.length
  const totalSize =
    state.totalSize ??
    state.files.reduce((sum, file) => sum + (file.size ?? 0), 0)

  return { totalFiles, totalSize }
}

export const getPreviewSelectionSummary = (
  state: TorrentContentPreviewState,
  selectedFileIndices: Set<number>,
) => {
  let selectedCount = 0
  let selectedSize = 0

  for (const file of state.files) {
    if (selectedFileIndices.has(file.index)) {
      selectedCount += 1
      selectedSize += file.size ?? 0
    }
  }

  return { selectedCount, selectedSize }
}
