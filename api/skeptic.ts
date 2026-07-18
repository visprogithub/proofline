import { createSkepticHandler, type SkepticServerEnvironment } from '../src/server/skeptic-handler'

const runtime = globalThis as typeof globalThis & {
  process?: { env?: SkepticServerEnvironment }
}

const handler = createSkepticHandler({ env: runtime.process?.env ?? {} })

export default handler
