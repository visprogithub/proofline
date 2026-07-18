import { createInMemoryQuotaStore, createSkepticHandler, type SkepticServerEnvironment } from '../src/server/skeptic-handler.js'

const runtime = globalThis as typeof globalThis & {
  process?: { env?: SkepticServerEnvironment }
}

const handler = createSkepticHandler({ env: runtime.process?.env ?? {}, quotaStore: createInMemoryQuotaStore() })

export default {
  fetch(request: Request): Promise<Response> {
    return handler(request)
  },
}
