import sql from 'mssql'
import { FastifyBaseLogger } from 'fastify'

export default class Document {
  schema: string = 'document.'
  _logger: FastifyBaseLogger
  _pool: sql.ConnectionPool

  constructor(logger: FastifyBaseLogger, pool: sql.ConnectionPool) {
    this._logger = logger
    this._pool = pool
  }

  async findOne(filters: any) {
    try {
      const r = new sql.Request(this._pool)
      r.input('id', sql.Int, filters.id)
      r.input('guid', sql.UniqueIdentifier, filters.guid)
      r.input('company', sql.Char, filters.company)
      r.input('company_oe', sql.Char, filters.companyOe)
      r.input('object_type', sql.VarChar, filters.objectType)
      r.input('document_type', sql.VarChar, filters.documentType)
      r.input('object_id', sql.BigInt, filters.objectId)
      r.input('culture', sql.VarChar, filters.culture)
      const result = await r.execute(`${this.schema}usp_findOne`)

      if (result.recordset && result.recordset.length === 1) {
        this._logger.debug(`${this.schema}usp_findOne returned one record!`)
        return result.recordset[0]
      } else if (result.recordset && result.recordset.length > 1) {
        this._logger.warn(`${this.schema}usp_findOne returned multiple records!`)
        console.error('Wrong number of records, return first result')
        return result.recordset[0]
      } else {
        this._logger.debug(`${this.schema}usp_findOne returned no records!`)
        return undefined
      }
    } catch (err) {
      throw err
    }
  }

  async getObjectList(company: string, object_type: string, object_id: number, user_id?: number): Promise<DBResultSet> {
    try {
      const r = new sql.Request(this._pool)
      r.input('company', sql.VarChar, company)
      r.input('object_type', sql.VarChar, object_type)
      r.input('object_id', sql.BigInt, object_id)
      r.input('user_id', sql.Int, user_id)
      const result = await r.execute(`${this.schema}usp_getObjectTypeList`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else
        throw new Error(error)
    } catch (err) {
      throw err
    }
  }

  async getDocumentList(company: string, object_type: string, document_type: string, user_id?: number): Promise<any> {
    try {
      const r = new sql.Request(this._pool)
      r.input('company', sql.VarChar, company)
      r.input('object_type', sql.VarChar, object_type)
      r.input('document_type', sql.VarChar, document_type)
      r.input('user_id', sql.Int, user_id)
      const result = await r.execute(`${this.schema}usp_getDocumentTypeList`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else
        throw new Error(error)
    } catch (err) {
      throw err
    }
  }

  async getArticleImageList(company: string, object_id: number, culture: string, user_id?: number): Promise<DBResultSet> {
    try {
      const r = new sql.Request(this._pool)
      r.input('company', sql.VarChar, company)
      r.input('object_id', sql.BigInt, object_id)
      r.input('culture', sql.VarChar, culture)
      r.input('user_id', sql.Int, user_id)
      const result = await r.execute(`${this.schema}usp_getArticleImagesList`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else
        throw new Error(error)
    } catch (err) {
      throw err
    }
  }
}

export interface DBResultSet {
  error: string
  verified: boolean
  result: any[]
}
