import { t } from 'elysia'

export const authLoginBodySchema = t.Object({
  email: t.String({ minLength: 3, maxLength: 320 }),
  password: t.String({ minLength: 1, maxLength: 1024 }),
})
