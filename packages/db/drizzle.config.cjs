const path = require('node:path')
const dotenv = require('dotenv')
const { defineConfig } = require('drizzle-kit')

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  override: false,
})

console.log('[drizzle] DATABASE_URL =', process.env.DATABASE_URL)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in ../../.env')
}

module.exports = defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
