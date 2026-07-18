import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer, loadEnv } from 'vite'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const mode = 'development'
const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
const vite = await createViteServer({
  appType: 'spa',
  mode,
  server: { middlewareMode: true },
})
const { createInMemoryQuotaStore, createSkepticHandler } = await vite.ssrLoadModule('/src/server/skeptic-handler.ts')
const skepticHandler = createSkepticHandler({ env, quotaStore: createInMemoryQuotaStore() })

async function requestBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 25_000) throw new Error('Request body exceeded the local development limit.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const server = createHttpServer(async (incoming, outgoing) => {
  if (incoming.url?.split('?')[0] !== '/api/skeptic') {
    vite.middlewares(incoming, outgoing)
    return
  }

  try {
    const headers = new Headers()
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
      else if (value !== undefined) headers.set(name, value)
    }
    const body = await requestBody(incoming)
    const request = new Request(`http://localhost:${port}${incoming.url}`, {
      method: incoming.method,
      headers,
      ...(body.length ? { body } : {}),
    })
    const response = await skepticHandler(request)
    outgoing.statusCode = response.status
    response.headers.forEach((value, name) => outgoing.setHeader(name, value))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    outgoing.statusCode = 500
    outgoing.setHeader('Content-Type', 'application/json')
    outgoing.end(JSON.stringify({ code: 'local-server-error', message: 'The local skeptic adapter failed.' }))
  }
})

server.listen(port, () => {
  process.stdout.write(`Proofline local app and API ready at http://localhost:${port}\n`)
})
