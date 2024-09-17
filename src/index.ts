import Fastify from '@groupclaes/fastify-elastic'
import { FastifyInstance } from 'fastify'
import { env } from 'process'

import fileController from './controllers/file.controller'
import listController from './controllers/list.controller'

const LOGLEVEL = 'debug'

export default async function (config: any): Promise<FastifyInstance | undefined> {
  if (!config || !config.wrapper) return

  // add jwt configuration object to config since we want to force JWT
  const fastify = await Fastify({ ...config.wrapper })
  const version_prefix = env.APP_VERSION ? '/' + env.APP_VERSION : ''
  fastify.log.level = LOGLEVEL
  await fastify.register(fileController, { prefix: `${version_prefix}/${config.wrapper.serviceName}/file`, logLevel: LOGLEVEL })
  await fastify.register(listController, { prefix: `${version_prefix}/${config.wrapper.serviceName}/list`, logLevel: LOGLEVEL })
  await fastify.listen({ port: +(env['PORT'] ?? 80), host: '::' })

  return fastify
}