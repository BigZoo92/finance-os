const fs = require('node:fs')
const path = require('node:path')

const dir = path.join('packages', 'db', 'drizzle', 'meta')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_journal.json')

const metas = files
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .sort((a, b) => a.when - b.when)

const sql =
  'TRUNCATE "__drizzle_migrations" RESTART IDENTITY;\n' +
  'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES\n' +
  metas.map(m => `('${m.hash}', ${m.when})`).join(',\n') +
  ';\n'

fs.writeFileSync('drizzle_fix.sql', sql, 'utf8')
console.log('Wrote drizzle_fix.sql')
