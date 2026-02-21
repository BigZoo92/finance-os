import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const technicalProbe = pgTable('technical_probe', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  label: text('label').notNull().default('bootstrap'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
