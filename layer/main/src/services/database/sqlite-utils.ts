import type { Database, RunResult } from 'sqlite3'

export type SqliteDatabase = Database

const normalizeParams = (params?: unknown[] | unknown): unknown[] => {
  if (Array.isArray(params)) {
    return params
  }

  if (params === undefined) {
    return []
  }

  return [params]
}

export const exec = (db: Database, sql: string) =>
  new Promise<void>((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

export const run = (db: Database, sql: string, params?: unknown[] | unknown) =>
  new Promise<RunResult>((resolve, reject) => {
    const normalized = normalizeParams(params)
    db.run(sql, normalized, function (this: RunResult, error: Error | null) {
      if (error) {
        reject(error)
        return
      }

      resolve(this)
    })
  })

export const get = <T = unknown>(
  db: Database,
  sql: string,
  params?: unknown[] | unknown,
) =>
  new Promise<T | undefined>((resolve, reject) => {
    const normalized = normalizeParams(params)
    db.get(sql, normalized, (error: Error | null, row: unknown) => {
      if (error) {
        reject(error)
        return
      }

      resolve(row as T | undefined)
    })
  })

export const all = <T = unknown>(
  db: Database,
  sql: string,
  params?: unknown[] | unknown,
) =>
  new Promise<T[]>((resolve, reject) => {
    const normalized = normalizeParams(params)
    db.all(sql, normalized, (error: Error | null, rows: unknown[]) => {
      if (error) {
        reject(error)
        return
      }

      resolve(rows as T[])
    })
  })

export const close = (db: Database) =>
  new Promise<void>((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
