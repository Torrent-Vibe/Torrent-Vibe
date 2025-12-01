import { computeMainHashFromRoots } from './lib/main-hash.js'

export const mainHash = computeMainHashFromRoots([
  'layer/main/src',
  'layer/main/preload',
])

console.info('[main-hash] mainHash', mainHash)
