// External dependencies
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { env } from 'process'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

import Document from '../repositories/document.repository'
import Tools from '../repositories/tools'

export default async function (fastify: FastifyInstance) {
  fastify.get('/:uuid', async (request: FastifyRequest<{
    Params: {
      uuid: string
    }
  }>, reply: FastifyReply) => {
    let contentMode = 'attachment'
    // fix CSP
    reply.header('Content-Security-Policy', `default-src 'self' 'unsafe-inline' pcm.groupclaes.be`)
    if ('show' in (request.query as any)) {
      contentMode = 'inline'
    }

    try {
      const repository = new Document()
      // const token = request.token || { sub: null }
      let uuid: string = request.params['uuid'].toLowerCase()

      let document = await repository.findOne({
        guid: uuid
      })

      if (document) {
        const _guid = document.guid.toLowerCase()
        const _fn = `${env['DATA_PATH']}/content/${_guid.substring(0, 2)}/${_guid}/file`

        if (fs.existsSync(_fn)) {
          const lastMod = fs.statSync(_fn).mtime

          const document_name_encoded = encodeURI(document.name)
          let filename = `filename="${document_name_encoded}"; filename*=UTF-8''${document_name_encoded}`

          if (contentMode === 'inline') {
            filename = `filename="${document.documentType}_${document.itemNum}.${document.extension}"`
          }

          reply
            .header('Cache-Control', `must-revalidate, max-age=${document.maxAge}, private`)
            .header('document-guid', _guid)
            .header('Expires', new Date(new Date().getTime() + (document.maxAge * 1000)).toUTCString())
            .header('Last-Modified', lastMod.toUTCString())
            .header('Content-Disposition', `${contentMode}; ${filename}`)
            .type(document.mimeType)

          // if company is bra, objectType is article and documentType is datasheet or technische-fiche
          // edit first page, stamp with itemnum and description
          let success = false
          try {
            if (Tools.shouldModifyPDF(document)) {
              const pdfDoc = await PDFDocument.load(fs.readFileSync(_fn), { ignoreEncryption: true })

              const pages = pdfDoc.getPages()
              const firstPage = pages[0]
              const { height, width } = firstPage.getSize()

              const pageRotation = firstPage.getRotation().angle
              const rotationRads = pageRotation * Math.PI / 180

              const x = 10
              const y = 10
              const fontSize = 10

              //These coords are now from bottom/left
              let coordsFromBottomLeft = {
                x: x,
                y: 0
              }
              if (pageRotation === 90 || pageRotation === 270) {
                coordsFromBottomLeft.y = width - (y + fontSize)
              }
              else {
                coordsFromBottomLeft.y = height - (y + fontSize)
              }

              let drawX: number = 0
              let drawY: number = 0

              if (pageRotation === 90) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads) + width
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads)
              }
              else if (pageRotation === 180) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads) + width
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads) + height
              }
              else if (pageRotation === 270) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads)
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads) + height
              }
              else {
                // no rotation
                drawX = coordsFromBottomLeft.x
                drawY = coordsFromBottomLeft.y
              }

              firstPage.drawText(`${document.itemNum} ${document.itemName ?? document.name}`, {
                x: drawX,
                y: drawY,
                size: fontSize,
                rotate: firstPage.getRotation()
              })

              success = true
              const pdfBytes = await pdfDoc.save()
              return reply
                .send(Buffer.from(pdfBytes))
            }
          } catch (err) {
            console.log(err)
          } finally {
            if (!success) {
              const stream = fs.createReadStream(_fn)
              return reply
                .send(stream)
            }
          }
        }
        return reply
          .code(404)
          .send({
            status: 'Not Found',
            statusCode: 404,
            message: `File '${_guid}' not found`
          })
      } else {
        return reply
          .status(404)
          .send({
            status: 'Not Found',
            statusCode: 404,
            message: 'Document not found'
          })
      }
    } catch (err) {
      return reply
        .status(500)
        .send(err)
    }
  })

  fastify.get('/:documentType/:objectId/:culture', async (request: FastifyRequest<{
    Params: {
      documentType: string
      objectId: number
      culture: string
    }, Headers: {
      accept?: string
    }
  }>, reply: FastifyReply) => {
    let contentMode = 'attachment'
    // fix CSP
    reply.header('Content-Security-Policy', `default-src 'self' 'unsafe-inline' pcm.groupclaes.be`)
    if ('show' in (request.query as any)) {
      contentMode = 'inline'
    }

    try {
      const repository = new Document()
      // const token = request.token || { sub: null }

      let company: string = Tools.resolveCompany(request)
      let objectType: string = 'artikel'
      let documentType: string = request.params['documentType'].toLowerCase()
      let objectId: number = +request.params['objectId']
      let culture: string = request.params['culture'].toLowerCase()

      const thumbnail = documentType === 'display-image'
      if (thumbnail) documentType = 'foto'

      let document
      // If ALG company should be queried, then do so
      if (Tools.shouldFindCommon(company, objectType, documentType)) {
        document = await repository.findOne({
          company: 'alg',
          objectType,
          documentType,
          objectId,
          culture
        })
      }
      // If no document was found in ALG (or ALG is not required), then find with given params
      if (!document) {
        document = await repository.findOne({
          company,
          objectType,
          documentType,
          objectId,
          culture
        })
      }
      if (!document && company === 'bra') {
        document = await repository.findOne({
          company: 'dis',
          objectType,
          documentType,
          objectId,
          culture
        })
      }

      if (document) {
        const _guid = document.guid.toLowerCase()
        const _fn = `${env['DATA_PATH']}/content/${_guid.substring(0, 2)}/${_guid}/file`

        if (fs.existsSync(_fn)) {
          if (thumbnail && documentType === 'foto') {
            return reply.redirect(307, `https://pcm.groupclaes.be/v3/product-images/${_guid}?s=thumb`)
          }
          const lastMod = fs.statSync(_fn).mtime

          const document_name_encoded = encodeURI(document.name)
          let filename = `filename="${document_name_encoded}"; filename*=UTF-8''${document_name_encoded}`

          if (contentMode === 'inline') {
            filename = `filename="${document.documentType}_${document.itemNum}.${document.extension}"`
          }

          reply
            .header('Cache-Control', `must-revalidate, max-age=${document.maxAge}, private`)
            .header('document-guid', _guid)
            .header('Expires', new Date(new Date().getTime() + (document.maxAge * 1000)).toUTCString())
            .header('Last-Modified', lastMod.toUTCString())
            .header('Content-Disposition', `${contentMode}; ${filename}`)
            .type(document.mimeType)

          // if company is bra, objectType is article and documentType is datasheet or technische-fiche
          // edit first page, stamp with itemnum and description
          let success = false
          try {
            if (Tools.shouldModifyPDF(document)) {
              const pdfDoc = await PDFDocument.load(fs.readFileSync(_fn), { ignoreEncryption: true })

              const pages = pdfDoc.getPages()
              const firstPage = pages[0]
              const { height, width } = firstPage.getSize()

              const pageRotation = firstPage.getRotation().angle
              const rotationRads = pageRotation * Math.PI / 180

              const x = 10
              const y = 10
              const fontSize = 10

              //These coords are now from bottom/left
              let coordsFromBottomLeft = {
                x: x,
                y: 0
              }
              if (pageRotation === 90 || pageRotation === 270) {
                coordsFromBottomLeft.y = width - (y + fontSize)
              }
              else {
                coordsFromBottomLeft.y = height - (y + fontSize)
              }

              let drawX: number = 0
              let drawY: number = 0

              if (pageRotation === 90) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads) + width
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads)
              }
              else if (pageRotation === 180) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads) + width
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads) + height
              }
              else if (pageRotation === 270) {
                drawX = coordsFromBottomLeft.x * Math.cos(rotationRads) - coordsFromBottomLeft.y * Math.sin(rotationRads)
                drawY = coordsFromBottomLeft.x * Math.sin(rotationRads) + coordsFromBottomLeft.y * Math.cos(rotationRads) + height
              }
              else {
                // no rotation
                drawX = coordsFromBottomLeft.x
                drawY = coordsFromBottomLeft.y
              }

              firstPage.drawText(`${document.itemNum} ${document.itemName ?? document.name}`, {
                x: drawX,
                y: drawY,
                size: fontSize,
                rotate: firstPage.getRotation()
              })
              pdfDoc.setTitle(document.name)
              pdfDoc.setSubject('')
              pdfDoc.setProducer('PCM')
              pdfDoc.setCreator('PCM API v3 - webshop/file')
              pdfDoc.setModificationDate(new Date())

              success = true
              const pdfBytes = await pdfDoc.save()
              return reply
                .send(Buffer.from(pdfBytes))
            }
          } catch (err) {
            console.log(err)
          } finally {
            if (!success) {
              const stream = fs.createReadStream(_fn)
              return reply
                .send(stream)
            }
          }
        }
        return reply
          .code(404)
          .send({
            status: 'Not Found',
            statusCode: 404,
            message: `File '${_guid}' not found`
          })
      } else {
        if (thumbnail) {
          if (request.headers.accept && request.headers.accept.indexOf('image/svg+xml') > -1) {
            reply.type('image/svg+xml')
            if (culture === 'nl') {
              const stream = fs.createReadStream('./assets/404_nl.svg')
              return reply.send(stream)
            } else if (culture === 'fr') {
              const stream = fs.createReadStream('./assets/404_fr.svg')
              return reply.send(stream)
            } else {
              const stream = fs.createReadStream('./assets/404.svg')
              return reply.send(stream)
            }
          } else {
            reply.type('image/png')
            if (culture === 'nl') {
              const stream = fs.createReadStream('./assets/404_nl.png')
              return reply.send(stream)
            } else if (culture === 'fr') {
              const stream = fs.createReadStream('./assets/404_fr.png')
              return reply.send(stream)
            } else {
              const stream = fs.createReadStream('./assets/404.png')
              return reply.send(stream)
            }
          }
        }
        return reply
          .status(404)
          .send({
            status: 'Not Found',
            statusCode: 404,
            message: 'Document not found'
          })
      }
    } catch (err) {
      return reply
        .status(500)
        .send(err)
    }
  })
}