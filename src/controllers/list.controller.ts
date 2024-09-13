// External dependencies
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import sql from 'mssql'
import { env } from 'process'

import Document from '../repositories/document.repository'
import Tools from '../repositories/tools'

declare module 'fastify' {
  export interface FastifyInstance {
    getSqlPool: (name?: string) => Promise<sql.ConnectionPool>
  }
  export interface FastifyReply {
    success: (data?: any, code?: number, executionTime?: number) => FastifyReply
    fail: (data?: any, code?: number, executionTime?: number) => FastifyReply
    error: (message?: string, code?: number, executionTime?: number) => FastifyReply
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/images/:objectId/:culture', async (request: FastifyRequest<{
    Params: {
      objectId: number
      culture: string
    }
  }>, reply: FastifyReply) => {
    const start = performance.now()
    try {
      const pool = await fastify.getSqlPool()
      const repo = new Document(request.log, pool)

      let company: string = Tools.resolveCompany(request)
      let objectId: number = +request.params['objectId']
      let culture: string = request.params['culture']


      const promises: Promise<any>[] = []
      promises.push(repo.getArticleImageList(company, objectId, culture))
      promises.push(repo.getArticleImageList('alg', objectId, culture))

      if (company === 'bra')
        promises.push(repo.getArticleImageList('dis', objectId, culture))

      const responses = await Promise.all(promises)

      console.log(responses, company, objectId, culture)

      if (responses.length === 3 && responses[2].verified && responses[2].result.length > 0)
        responses[0].result = responses[0].result.concat(responses[2].result)

      if (responses[1].verified && responses[1].result.length > 0)
        responses[0].result = responses[0].result.concat(responses[1].result)

      if (responses[0].verified) {
        if (responses[0].result.length > 0)
          return reply.success(responses[0].result, 200, performance.now() - start)
        else
          return reply.success([{
            name: 'no-image.jpg',
            guid: '7fde9141-467a-4a1d-902f-079909bcc5be',
            altText: null
          }], 200, performance.now() - start)
      }

      return reply.fail({ message: 'Session has expired!' }, 401, performance.now() - start)
    } catch (err) {
      throw err
    }
  })

  fastify.get('/objects/:objectId', async (request: FastifyRequest<{
    Params: {
      objectId: number
    }
  }>, reply: FastifyReply) => {
    const start = performance.now()
    try {
      const pool = await fastify.getSqlPool()
      const repo = new Document(request.log, pool)
      // const token = request.token || { sub: null }

      let company: string = Tools.resolveCompany(request)
      let objectType: string = 'artikel'
      let objectId: number = +request.params['objectId']

      const promises: Promise<any>[] = []
      promises.push(repo.getObjectList(company, objectType, objectId))
      promises.push(repo.getObjectList('alg', objectType, objectId))

      const responses = await Promise.all(promises)

      if (responses[1].verified && responses[1].result.length > 0)
        responses[0].result = responses[0].result.concat(responses[1].result)

      if (responses[0].verified) {
        responses[0].result.filter(e => e.type === 'foto')
          .forEach(e => {
            responses[0].result.push({
              ...e,
              type: 'display-image',
              // thumbnails are the only exception and should always be retrieved using product-images endpoint
              downloadUrl: `https://pcm.groupclaes.be/${env['APP_VERSION']}/product-images/${e.guid}?s=thumb`
            })
          })

        return reply.success(responses[0].result.map(e => ({
          name: e.name,
          objectType,
          documentType: e.type,
          objectIds: [
            objectId
          ],
          size: e.size,
          extension: e.extension,
          languages: e.languages ? e.languages.map(x => x.name) : [],
          downloadUrl: e.downloadUrl || `https://pcm.groupclaes.be/${env['APP_VERSION']}/webshop/file/${e.guid}`
        }), 200, performance.now() - start))
      }
      return reply.fail({ message: 'Session has expired!' }, 401, performance.now() - start)
    } catch (err) {
      throw err
    }
  })

  fastify.get('/documents/:documentType', async (request: FastifyRequest<{
    Params: {
      documentType: string
    }
  }>, reply: FastifyReply) => {
    const start = performance.now()
    try {
      const pool = await fastify.getSqlPool()
      const repo = new Document(request.log, pool)
      // const token = request.token || { sub: null }

      let company: string = Tools.resolveCompany(request)
      let objectType: string = 'artikel'
      let documentType: string = request.params['documentType'].toLowerCase()

      const list1 = repo.getDocumentList(company, objectType, documentType)
      const list2 = repo.getDocumentList('alg', objectType, documentType)

      const responses = await Promise.all([list1, list2])

      if (responses[1].verified && responses[1].result.length > 0)
        responses[0].result = responses[0].result.concat(responses[1].result)

      if (responses[0].verified) {
        return reply.success(responses[0].result.map(e => ({
          name: e.name,
          languages: e.languages || {},
          downloadUrl: `https://pcm.groupclaes.be/${env['APP_VERSION']}/webshop/file/${e.guid}`
        })), 200, performance.now() - start)
      }
      return reply.fail({ message: 'Session has expired!' }, 401, performance.now() - start)
    } catch (err) {
      throw err
    }
  })
}