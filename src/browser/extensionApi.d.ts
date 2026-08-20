declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>
      set(value: Record<string, unknown>): Promise<void>
      remove(key: string): Promise<void>
    }
  }
  runtime: {
    sendMessage(message: unknown): Promise<unknown>
    onMessage: {
      addListener(listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void): void
    }
  }
}
