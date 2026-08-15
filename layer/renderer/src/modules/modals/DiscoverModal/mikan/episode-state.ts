export const episodeStateLabelKey = (state: string): I18nKeys => {
  switch (state) {
    case 'added': {
      return 'discover.modal.mikan.episodeState.added'
    }
    case 'downloading': {
      return 'discover.modal.mikan.episodeState.downloading'
    }
    case 'renaming': {
      return 'discover.modal.mikan.episodeState.renaming'
    }
    case 'done': {
      return 'discover.modal.mikan.episodeState.done'
    }
    case 'failed': {
      return 'discover.modal.mikan.episodeState.failed'
    }
    case 'needs-manual': {
      return 'discover.modal.mikan.episodeState.needsManual'
    }
    default: {
      return 'discover.modal.mikan.episodeState.pending'
    }
  }
}
