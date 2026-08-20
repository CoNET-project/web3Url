import type { PostBody } from '../protocol/gatewayEnvelope'

export type EntryTransport = (entry: string, body: PostBody, signal: AbortSignal) => Promise<string>

export class EntryPool {
  private cursor = 0

  constructor(
    private readonly entries: string[],
    private readonly transport: EntryTransport
  ) {
    if (!entries.length) throw new Error('At least one entry is required')
  }

  async post(body: PostBody, timeoutMs = 12_000): Promise<string> {
    const order = this.randomizedOrder()
    let lastError: unknown
    for (const index of order) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await this.transport(this.entries[index], body, controller.signal)
      } catch (error) {
        lastError = error
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All entries failed')
  }

  private randomizedOrder(): number[] {
    const start = this.cursor++ % this.entries.length
    return Array.from({ length: this.entries.length }, (_, offset) => (start + offset) % this.entries.length)
      .sort(() => Math.random() - 0.5)
  }
}
