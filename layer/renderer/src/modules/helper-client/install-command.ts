export const HELPER_RELEASE_REPO = 'Torrent-Vibe/Torrent-Vibe'

export const helperInstallCommand = (input: {
  arch: 'amd64' | 'arm64'
  repoSlug?: string
}): string => {
  const repo = input.repoSlug ?? HELPER_RELEASE_REPO
  const asset = `torrent-vibe-helper_linux_${input.arch}`
  const url = `https://github.com/${repo}/releases/latest/download/${asset}`
  return [
    `mkdir -p "$HOME/.local/bin"`,
    `curl -fsSL -o "$HOME/.local/bin/torrent-vibe-helper" \\`,
    `  "${url}"`,
    `chmod +x "$HOME/.local/bin/torrent-vibe-helper"`,
    `"$HOME/.local/bin/torrent-vibe-helper" install`,
  ].join('\n')
}
