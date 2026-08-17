import { bootstrap } from './bootstrap'
import { installStdioEpipeGuard } from './utils/stdio-epipe'

installStdioEpipeGuard()
bootstrap.initialize().catch(console.error)
