import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

export function validateBody<T>(schema: ZodType<T>) {
  return (request: Request, response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body)
    if (!result.success) {
      response.status(400).json({
        error: 'Invalid request body',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    request.body = result.data
    next()
  }
}
