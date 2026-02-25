import { Elysia } from 'elysia'
import type { PowensRouteRuntime } from './types'

export const createPowensRuntimePlugin = (runtime: PowensRouteRuntime) => {
  return new Elysia().decorate('powens', runtime)
}
