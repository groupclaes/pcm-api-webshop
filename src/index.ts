import Fastify from '@groupclaes/fastify-elastic'
import { FastifyInstance } from 'fastify'
import process, { env } from 'process'

import config from './config'
import fileController from './controllers/file.controller'
import listController from './controllers/list.controller'

let fastify: FastifyInstance | undefined

/** Main loop */
async function main() {
  fastify = await Fastify((config.wrapper as any))
  const version_prefix = env.APP_VERSION ? '/' + env.APP_VERSION : ''

  await fastify.register(fileController, { prefix: `${version_prefix}/${config.wrapper.serviceName}/file`, logLevel: 'warn' })
  await fastify.register(listController, { prefix: `${version_prefix}/${config.wrapper.serviceName}/list`, logLevel: 'info' })

  await fastify.listen({ port: +(env['PORT'] ?? 80), host: '::' })
}

['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, async () => {
    await fastify?.close()
    process.exit(0)
  })
})

main()