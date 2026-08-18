export const HELPER_RELEASE_REPO = 'Torrent-Vibe/Torrent-Vibe'
export const HELPER_BIN_DIR = '.local/bin'
export const HELPER_BIN_NAME = 'torrent-vibe-helper'

export const helperInstallCommand = (input: {
  arch: 'amd64' | 'arm64'
  repoSlug?: string
}): string => {
  const repo = input.repoSlug ?? HELPER_RELEASE_REPO
  const asset = `torrent-vibe-helper_linux_${input.arch}`
  const url = `https://github.com/${repo}/releases/latest/download/${asset}`
  const target = `"$HOME/${HELPER_BIN_DIR}/${HELPER_BIN_NAME}"`
  return [
    `mkdir -p "$HOME/${HELPER_BIN_DIR}"`,
    `curl -fsSL -o ${target} \\`,
    `  "${url}"`,
    `chmod +x ${target}`,
    `${target} install`,
  ].join('\n')
}
