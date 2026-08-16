export const HELPER_RELEASE_REPO = 'Torrent-Vibe/Torrent-Vibe'

export const helperInstallCommand = (input: {
  arch: 'amd64' | 'arm64'
  repoSlug?: string
}): string => {
  const repo = input.repoSlug ?? HELPER_RELEASE_REPO
  const asset = `torrent-vibe-helper_linux_${input.arch}`
  const url = `https://github.com/${repo}/releases/latest/download/${asset}`
  return [
    `curl -fsSL -o torrent-vibe-helper \\`,
    `  "${url}"`,
    `chmod +x torrent-vibe-helper`,
    `sudo mv torrent-vibe-helper /usr/local/bin/torrent-vibe-helper`,
    `torrent-vibe-helper`,
  ].join('\n')
}
