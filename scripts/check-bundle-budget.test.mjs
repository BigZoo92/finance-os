import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkBundleBudget, evaluateBudget, measureBundle } from './check-bundle-budget.mjs'

const makeAssets = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'))
  writeFileSync(join(dir, 'index-abc.js'), 'console.log("hello world");\n'.repeat(300))
  writeFileSync(join(dir, 'chunk-def.js'), 'export const x = 1')
  writeFileSync(join(dir, 'styles-ghi.css'), 'body{margin:0}')
  writeFileSync(join(dir, 'font.woff2'), 'not measured')
  return dir
}

test('measureBundle reports raw and gzip totals and the largest chunk', () => {
  const measurement = measureBundle(makeAssets())
  assert.equal(measurement.jsFiles, 2)
  assert.ok(measurement.jsRawBytes > measurement.jsGzipBytes)
  assert.equal(measurement.largestJsChunk.name, 'index-abc.js')
  assert.ok(measurement.cssGzipBytes > 0)
})

test('evaluateBudget lists only the exceeded metrics', () => {
  const measurement = measureBundle(makeAssets())
  assert.deepEqual(evaluateBudget(measurement, { jsGzipBytes: 10_000_000 }), [])
  const violations = evaluateBudget(measurement, { jsRawBytes: 1, largestJsChunkGzipBytes: 1 })
  assert.deepEqual(
    violations.map(violation => violation.metric),
    ['jsRawBytes', 'largestJsChunkGzipBytes']
  )
})

test('checkBundleBudget reads the budget file and fails on a tiny budget', () => {
  const dir = makeAssets()
  const budgetFile = join(dir, 'budget.json')
  writeFileSync(budgetFile, JSON.stringify({ jsGzipBytes: 1 }))
  const result = checkBundleBudget({ assetsDir: dir, budgetFile })
  assert.equal(result.violations.length, 1)
  assert.equal(result.violations[0].metric, 'jsGzipBytes')
})
