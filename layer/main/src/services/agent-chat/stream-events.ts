import type { AgentChatStreamEvent } from '@torrent-vibe/shared'

type DeltaEvent = AgentChatStreamEvent & {
  type: 'reasoning-delta' | 'text-delta'
}

export class AgentChatStreamEmitter {
  private pending: DeltaEvent[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly send: (event: AgentChatStreamEvent) => void,
    private readonly delayMs = 16,
  ) {}

  push(event: DeltaEvent): void {
    const previous = this.pending.at(-1)
    if (
      previous?.type === event.type &&
      previous.contentIndex === event.contentIndex &&
      previous.turn === event.turn
    ) {
      previous.delta += event.delta
      previous.sequence = event.sequence
    } else {
      this.pending.push({ ...event })
    }
    this.timer ??= setTimeout(() => this.flush(), this.delayMs)
  }

  emit(event: AgentChatStreamEvent): void {
    this.flush()
    this.send(event)
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    for (const event of this.pending) {
      this.send(event)
    }
    this.pending = []
  }
}
