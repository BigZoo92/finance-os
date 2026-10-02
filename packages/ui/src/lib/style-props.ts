import { css } from '@finance-os/styled-system/css'
import { splitCssProps } from '@finance-os/styled-system/jsx'
import type { SystemStyleObject } from '@finance-os/styled-system/types'

/**
 * Style props on function components.
 *
 * Shared components that are plain functions (Amount, Status, Progress,
 * Panel…) accept the same style props as `styled()` components. This helper
 * splits them off the incoming props and merges them into the component's
 * own styles at the object level, so a consumer's `mt`, `textStyle`,
 * `sm={{…}}` or `css={{…}}` wins deterministically, whatever the order of
 * the atoms in the generated sheet. Panda extracts those props statically
 * because the component's JSX tag is capitalized.
 *
 * `className` is still concatenated by the caller (`cx(styles, className)`)
 * for non-style classes; it must not be used to override the component's
 * own declarations.
 */
export function withStyleProps<T extends object>(
  props: T,
  ...base: Array<SystemStyleObject | undefined>
) {
  const [{ css: cssProp, ...styleProps }, rest] = splitCssProps(props)
  return { className: css(...base, styleProps, cssProp), rest }
}
