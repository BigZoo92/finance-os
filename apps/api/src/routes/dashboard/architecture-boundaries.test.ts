/**
 * Bounded-module boundaries for the dashboard API.
 *
 * Layers: HTTP routes (`routes/`) -> use cases composed in `runtime.ts` ->
 * domain modules (`domain/<module>/`) -> repositories (`repositories/`).
 *
 * Rules (each one maps to a test below):
 * 1. A domain module is entered through its barrel (`domain/<module>/index.ts`);
 *    no code outside the module imports its internal files.
 * 2. Domain code never imports repository implementations at runtime; only
 *    repository types (contracts) may cross that boundary.
 * 3. HTTP route modules never construct repositories: they receive them from
 *    the runtime composition root.
 * 4. `types.ts` (the dashboard contract) imports domain code as types only.
 * 5. Domain code never depends on the HTTP layer (`routes/` folder or Elysia).
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const dashboardRoot = path.resolve(import.meta.dir)
const MODULES = ['advisor', 'data-quality', 'trading-lab', 'valuation'] as const

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return listSourceFiles(full)
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
  })

const IMPORT_RE = /^import(\s+type)?[^;]*?from\s+'(\.[^']+)'/gms

interface ImportEdge {
  readonly file: string
  readonly target: string
  readonly typeOnly: boolean
}

const edges: ImportEdge[] = listSourceFiles(dashboardRoot).flatMap(file => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(IMPORT_RE)].map(match => ({
    file: path.relative(dashboardRoot, file),
    target: path.relative(dashboardRoot, path.resolve(path.dirname(file), match[2] ?? '')),
    typeOnly: Boolean(match[1]),
  }))
})

const moduleOf = (relative: string) =>
  MODULES.find(
    module => relative.startsWith(`domain/${module}/`) || relative === `domain/${module}`
  )

describe('dashboard bounded modules', () => {
  it('has a public barrel for every module', () => {
    for (const module of MODULES) {
      expect(statSync(path.join(dashboardRoot, 'domain', module, 'index.ts')).isFile()).toBe(true)
    }
  })

  it('1. enters a module only through its barrel', () => {
    const violations = edges.filter(edge => {
      const targetModule = moduleOf(edge.target)
      if (!targetModule || moduleOf(edge.file) === targetModule) return false
      return (
        edge.target !== `domain/${targetModule}` && edge.target !== `domain/${targetModule}/index`
      )
    })
    expect(violations.map(edge => `${edge.file} -> ${edge.target}`)).toEqual([])
  })

  it('2. keeps repository implementations out of domain code', () => {
    const violations = edges.filter(
      edge =>
        edge.file.startsWith('domain/') && edge.target.startsWith('repositories/') && !edge.typeOnly
    )
    expect(violations.map(edge => `${edge.file} -> ${edge.target}`)).toEqual([])
  })

  it('3. lets HTTP routes receive repositories instead of building them', () => {
    const violations = edges.filter(
      edge =>
        edge.file.startsWith('routes/') && edge.target.startsWith('repositories/') && !edge.typeOnly
    )
    expect(violations.map(edge => `${edge.file} -> ${edge.target}`)).toEqual([])
  })

  it('4. keeps the dashboard contract type-only towards the domain', () => {
    const violations = edges.filter(
      edge => edge.file === 'types.ts' && edge.target.startsWith('domain/') && !edge.typeOnly
    )
    expect(violations.map(edge => `${edge.file} -> ${edge.target}`)).toEqual([])
  })

  it('5. keeps HTTP concerns out of the domain', () => {
    const violations = edges.filter(
      edge => edge.file.startsWith('domain/') && edge.target.startsWith('routes/')
    )
    const elysiaImports = listSourceFiles(path.join(dashboardRoot, 'domain')).filter(file =>
      /from 'elysia'/.test(readFileSync(file, 'utf8'))
    )
    expect(violations.map(edge => `${edge.file} -> ${edge.target}`)).toEqual([])
    expect(elysiaImports.map(file => path.relative(dashboardRoot, file))).toEqual([])
  })
})
