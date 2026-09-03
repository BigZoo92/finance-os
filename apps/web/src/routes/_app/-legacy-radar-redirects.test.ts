import { describe, expect, it } from 'vitest'
import { Route as ActualitesRoute } from './actualites'
import { Route as MarchesRoute } from './marches'
import { RADAR_REDIRECT, Route as SignauxRoute } from './signaux/index'
import { Route as SignauxMarchesRoute } from './signaux/marches'
import { Route as SignauxSocialRoute, SOCIAL_REDIRECT } from './signaux/social'
import { Route as SignauxXTwitterRoute } from './signaux/x-twitter'

type LegacyRoute = { options: { beforeLoad?: (context: never) => unknown } }

const redirectThrownBy = async (route: LegacyRoute) => {
  const beforeLoad = route.options.beforeLoad
  if (!beforeLoad) throw new Error('Missing compatibility redirect')
  try {
    await beforeLoad({} as never)
  } catch (error) {
    return error
  }
  throw new Error('Legacy route did not redirect')
}

describe('legacy Radar routes', () => {
  it.each([
    ['/signaux', SignauxRoute],
    ['/signaux/marches', SignauxMarchesRoute],
    ['/marches', MarchesRoute],
    ['/actualites', ActualitesRoute],
  ])('%s redirects permanently to /radar', async (_path, route) => {
    expect(RADAR_REDIRECT).toEqual({ to: '/radar', statusCode: 301 })
    expect(await redirectThrownBy(route as LegacyRoute)).toMatchObject({ options: RADAR_REDIRECT })
  })
})

describe('legacy Social Intelligence routes', () => {
  it.each([
    ['/signaux/social', SignauxSocialRoute],
    ['/signaux/x-twitter', SignauxXTwitterRoute],
  ])('%s redirects permanently to /social-intelligence', async (_path, route) => {
    expect(SOCIAL_REDIRECT).toEqual({ to: '/social-intelligence', statusCode: 301 })
    expect(await redirectThrownBy(route as LegacyRoute)).toMatchObject({ options: SOCIAL_REDIRECT })
  })
})
