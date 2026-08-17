const guardedStreams = new WeakSet<NodeJS.WritableStream>()

function ignoreBrokenPipe(stream: NodeJS.WritableStream | null | undefined) {
  if (!stream || guardedStreams.has(stream)) {
    return
  }
  guardedStreams.add(stream)
  // Detached Electron (Finder, parent pipe closed) makes console.* throw uncaught write EPIPE.
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') {
      throw error
    }
  })
}

export function installStdioEpipeGuard(): void {
  ignoreBrokenPipe(process.stdout)
  ignoreBrokenPipe(process.stderr)
}
