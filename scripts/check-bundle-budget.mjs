#!/usr/bin/env node
/**
 * Client bundle budget: measures the built web client (gzip and raw bytes,
 * per-chunk and in total) and fails when a budget in
 * apps/web/bundle-budget.json is exceeded. The budgets are measured
 * baselines with headroom, not aspirations: raise them deliberately, in the
 * same change that explains the growth.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const DEFAULT_ASSETS_DIR = join(REPO_ROOT, 'apps', 'web', '.output', 'public', 'assets')
export const DEFAULT_BUDGET_FILE = join(REPO_ROOT, 'apps', 'web', 'bundle-budget.json')

export const measureBundle = assetsDir => {
  const files = readdirSync(assetsDir).filter(name => name.endsWith('.js') || name.endsWith('.css'))
  const chunks = files.map(name => {
    const raw = readFileSync(join(assetsDir, name))
    return { name, raw: raw.byteLength, gzip: gzipSync(raw, { level: 9 }).byteLength }
  })
  const js = chunks.filter(chunk => chunk.name.endsWith('.js'))
  const css = chunks.filter(chunk => chunk.name.endsWith('.css'))
  const sum = (list, key) => list.reduce((total, chunk) => total + chunk[key], 0)
  const largestJs = js.reduce((max, chunk) => (chunk.gzip > max.gzip ? chunk : max), {
    name: '',
    raw: 0,
    gzip: 0,
  })
  return {
    jsFiles: js.length,
    jsRawBytes: sum(js, 'raw'),
    jsGzipBytes: sum(js, 'gzip'),
    cssGzipBytes: sum(css, 'gzip'),
    largestJsChunk: largestJs,
  }
}

export const evaluateBudget = (measurement, budget) => {
  const checks = [
    ['jsGzipBytes', measurement.jsGzipBytes, budget.jsGzipBytes],
    ['jsRawBytes', measurement.jsRawBytes, budget.jsRawBytes],
    ['cssGzipBytes', measurement.cssGzipBytes, budget.cssGzipBytes],
    ['largestJsChunkGzipBytes', measurement.largestJsChunk.gzip, budget.largestJsChunkGzipBytes],
  ]
  return checks
    .filter(([, actual, limit]) => typeof limit === 'number' && actual > limit)
    .map(([metric, actual, limit]) => ({ metric, actual, limit }))
}

const formatKb = bytes => `${(bytes / 1024).toFixed(1)} kB`

export const checkBundleBudget = ({
  assetsDir = DEFAULT_ASSETS_DIR,
  budgetFile = DEFAULT_BUDGET_FILE,
} = {}) => {
  if (!statSync(assetsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Client assets not found at ${assetsDir}; build the web app first.`)
  }
  const budget = JSON.parse(readFileSync(budgetFile, 'utf8'))
  const measurement = measureBundle(assetsDir)
  const violations = evaluateBudget(measurement, budget)
  return { measurement, budget, violations }
}

const isDirectRun = () => {
  const entry = process.argv[1]
  return typeof entry === 'string' && resolve(entry) === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  const { measurement, violations } = checkBundleBudget()
  const summary =
    `${measurement.jsFiles} JS chunks, ${formatKb(measurement.jsGzipBytes)} gzip ` +
    `(${formatKb(measurement.jsRawBytes)} raw), CSS ${formatKb(measurement.cssGzipBytes)} gzip, ` +
    `largest chunk ${measurement.largestJsChunk.name} ${formatKb(measurement.largestJsChunk.gzip)} gzip`
  if (violations.length > 0) {
    console.error(`Client bundle budget exceeded: ${summary}`)
    for (const violation of violations) {
      console.error(`- ${violation.metric}: ${violation.actual} > ${violation.limit}`)
    }
    process.exit(1)
  }
  console.log(`Client bundle budget passed: ${summary}`)
}
