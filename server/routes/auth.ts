import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { signJwt } from '../auth'
import { query } from '../db/client'
import { validateBody } from '../middleware/validate'

const RegisterBodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

const LoginBodySchema = RegisterBodySchema

interface UserRow {
  id: string
  email: string
  password: string
  tenant_id: string
  role: string
}

export const authRouter = Router()

authRouter.post('/register', validateBody(RegisterBodySchema), async (request, response, next) => {
  try {
    const { email, password } = request.body as z.infer<typeof RegisterBodySchema>
    const passwordHash = await bcrypt.hash(password, 12)
    const tenantId = crypto.randomUUID()
    const result = await query<UserRow>(
      `
        insert into users (email, password, tenant_id)
        values ($1, $2, $3)
        returning id, email, password, tenant_id, role
      `,
      [email.toLowerCase(), passwordHash, tenantId]
    )
    const user = result.rows[0]
    response.status(201).json({
      token: signJwt({ userId: user.id, tenantId: user.tenant_id, role: user.role }),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role,
      },
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', validateBody(LoginBodySchema), async (request, response, next) => {
  try {
    const { email, password } = request.body as z.infer<typeof LoginBodySchema>
    const result = await query<UserRow>(
      `
        select id, email, password, tenant_id, role
        from users
        where email = $1
        limit 1
      `,
      [email.toLowerCase()]
    )
    const user = result.rows[0]
    if (!user) {
      response.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      response.status(401).json({ error: 'Invalid credentials' })
      return
    }

    response.json({
      token: signJwt({ userId: user.id, tenantId: user.tenant_id, role: user.role }),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role,
      },
    })
  } catch (error) {
    next(error)
  }
})
