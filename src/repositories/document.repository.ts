import sql from 'mssql'
import db from '../db'

export default class Document {
  async findOne(filters) {
    try {
      const request = new sql.Request(await db.get('PCM'))

      request.input('id', sql.Int, filters.id)
      request.input('guid', sql.UniqueIdentifier, filters.guid)
      request.input('company', sql.Char, filters.company)
      request.input('company_oe', sql.Char, filters.companyOe)
      request.input('object_type', sql.VarChar, filters.objectType)
      request.input('document_type', sql.VarChar, filters.documentType)
      request.input('object_id', sql.BigInt, filters.objectId)
      request.input('culture', sql.VarChar, filters.culture)

      let result = await request.query(`EXECUTE [document].[usp_findOne] @id, @guid, @company, @company_oe, @object_type, @document_type, @object_id, @culture`)

      if (result.recordset && result.recordset.length === 1) {
        return result.recordset[0]
      } else if (result.recordset && result.recordset.length > 1) {
        console.error('Wrong number of records, return first result')
        return result.recordset[0]
      }
      return undefined
    } catch (err) {
      throw err
    }
  }

  async getObjectList(company: string, object_type: string, object_id: number, user_id?: number): Promise<DBResultSet> {
    try {
      const request = new sql.Request(await db.get('PCM'))

      request.input('company', sql.VarChar, company)
      request.input('object_type', sql.VarChar, object_type)
      request.input('object_id', sql.BigInt, object_id)
      request.input('user_id', sql.Int, user_id)

      const result = await request.query(`EXECUTE [document].[usp_getObjectTypeList] @company, @object_type, @object_id, @user_id`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else {
        throw new Error(error)
      }
    } catch (err) {
      throw err
    }
  }

  async getDocumentList(company: string, object_type: string, document_type: string, user_id?: number): Promise<any> {
    try {
      const request = new sql.Request(await db.get('PCM'))

      request.input('company', sql.VarChar, company)
      request.input('object_type', sql.VarChar, object_type)
      request.input('document_type', sql.VarChar, document_type)
      request.input('user_id', sql.Int, user_id)

      const result = await request.query(`EXECUTE [document].[usp_getDocumentTypeList] @company, @object_type, @document_type, @user_id`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else {
        throw new Error(error)
      }
    } catch (err) {
      throw err
    }
  }

  async getArticleImageList(company: string, object_id: number, culture: string, user_id?: number): Promise<DBResultSet> {
    try {
      const request = new sql.Request(await db.get('PCM'))

      request.input('company', sql.VarChar, company)
      request.input('object_id', sql.BigInt, object_id)
      request.input('culture', sql.VarChar, culture)
      request.input('user_id', sql.Int, user_id)

      const result = await request.query(`EXECUTE [document].[usp_getArticleImagesList] @company, @object_id, @culture, @user_id`)

      const { error, verified } = result.recordset[0]

      if (!error) {
        return {
          error,
          verified,
          result: result.recordsets[1][0] || []
        }
      } else {
        throw new Error(error)
      }
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
