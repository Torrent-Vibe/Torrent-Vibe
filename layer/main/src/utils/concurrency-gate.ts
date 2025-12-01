export class ConcurrencyGate {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1
      return
    }

    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
    this.active += 1
  }

  release(): void {
    if (this.active > 0) {
      this.active -= 1
    }

    const next = this.queue.shift()
    if (next) {
      next()
    }
  }
}
