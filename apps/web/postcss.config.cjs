/**
 * Panda CSS emits its cascade layers into the stylesheet that declares them
 * (apps/web/src/styles.css). The configuration lives with the design tokens in
 * packages/styled-system.
 */
module.exports = {
  plugins: {
    '@pandacss/dev/postcss': {
      configPath: require('node:path').resolve(
        __dirname,
        '../../packages/styled-system/panda.config.ts'
      ),
    },
  },
}
