/**
 * RotatingText — accessible text rotator with per-character stagger.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/ts/tailwind/TextAnimations/RotatingText
 *
 * Finance-OS changes:
 *  - Respects `prefers-reduced-motion` — just renders the current text
 *    without cycling transitions
 *  - `auto` rotation can still be controlled imperatively via the ref
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Target,
  type TargetAndTransition,
  type Transition,
  type VariantLabels,
} from 'motion/react'

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ')
}

function splitIntoCharacters(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), s => s.segment)
  }
  return Array.from(text)
}

export type RotatingTextRef = {
  next: () => void
  previous: () => void
  jumpTo: (index: number) => void
  reset: () => void
}

export type RotatingTextProps = Omit<
  ComponentPropsWithoutRef<typeof motion.span>,
  'children' | 'transition' | 'initial' | 'animate' | 'exit'
> & {
  texts: string[]
  transition?: Transition
  initial?: boolean | Target | VariantLabels
  animate?: boolean | VariantLabels | TargetAndTransition
  exit?: Target | VariantLabels
  animatePresenceMode?: 'sync' | 'wait'
  animatePresenceInitial?: boolean
  rotationInterval?: number
  staggerDuration?: number
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number
  loop?: boolean
  auto?: boolean
  splitBy?: string
  onNext?: (index: number) => void
  mainClassName?: string
  splitLevelClassName?: string
  elementLevelClassName?: string
}

const RotatingText = forwardRef<RotatingTextRef, RotatingTextProps>(
  (
    {
      texts,
      transition = { type: 'spring', damping: 26, stiffness: 280 },
      initial = { y: '100%', opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: '-120%', opacity: 0 },
      animatePresenceMode = 'wait',
      animatePresenceInitial = false,
      rotationInterval = 3200,
      staggerDuration = 0.02,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      ...rest
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const [currentTextIndex, setCurrentTextIndex] = useState<number>(0)

    const elements = useMemo(() => {
      const currentText = texts[currentTextIndex] ?? ''
      if (splitBy === 'characters') {
        const words = currentText.split(' ')
        return words.map((word, i) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== words.length - 1,
        }))
      }
      if (splitBy === 'words') {
        return currentText.split(' ').map((word, i, arr) => ({
          characters: [word],
          needsSpace: i !== arr.length - 1,
        }))
      }
      if (splitBy === 'lines') {
        return currentText.split('\n').map((line, i, arr) => ({
          characters: [line],
          needsSpace: i !== arr.length - 1,
        }))
      }
      return currentText.split(splitBy).map((part, i, arr) => ({
        characters: [part],
        needsSpace: i !== arr.length - 1,
      }))
    }, [texts, currentTextIndex, splitBy])

    const getStaggerDelay = useCallback(
      (index: number, total: number) => {
        if (prefersReducedMotion) return 0
        if (staggerFrom === 'first') return index * staggerDuration
        if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration
        if (staggerFrom === 'center') {
          const center = Math.floor(total / 2)
          return Math.abs(center - index) * staggerDuration
        }
        if (staggerFrom === 'random') {
          const randomIndex = Math.floor(Math.random() * total)
          return Math.abs(randomIndex - index) * staggerDuration
        }
        return Math.abs((staggerFrom as number) - index) * staggerDuration
      },
      [staggerFrom, staggerDuration, prefersReducedMotion],
    )

    const handleIndexChange = useCallback(
      (newIndex: number) => {
        setCurrentTextIndex(newIndex)
        onNext?.(newIndex)
      },
      [onNext],
    )

    const next = useCallback(() => {
      const nextIndex =
        currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1
      if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex)
    }, [currentTextIndex, texts.length, loop, handleIndexChange])

    const previous = useCallback(() => {
      const prev =
        currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1
      if (prev !== currentTextIndex) handleIndexChange(prev)
    }, [currentTextIndex, texts.length, loop, handleIndexChange])

    const jumpTo = useCallback(
      (index: number) => {
        const valid = Math.max(0, Math.min(index, texts.length - 1))
        if (valid !== currentTextIndex) handleIndexChange(valid)
      },
      [texts.length, currentTextIndex, handleIndexChange],
    )

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) handleIndexChange(0)
    }, [currentTextIndex, handleIndexChange])

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset])

    useEffect(() => {
      if (!auto || prefersReducedMotion) return
      const id = setInterval(next, rotationInterval)
      return () => clearInterval(id)
    }, [next, rotationInterval, auto, prefersReducedMotion])

    return (
      <motion.span
        className={cx('flex flex-wrap whitespace-pre-wrap relative', mainClassName)}
        {...rest}
        layout
        transition={transition}
      >
        <span className="sr-only">{texts[currentTextIndex]}</span>
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span
            key={currentTextIndex}
            className={cx(splitBy === 'lines' ? 'flex flex-col w-full' : 'flex flex-wrap whitespace-pre-wrap relative')}
            layout
            aria-hidden="true"
          >
            {elements.map((wordObj, wordIndex, array) => {
              const previousCharsCount = array
                .slice(0, wordIndex)
                .reduce((sum, word) => sum + word.characters.length, 0)
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: words are transient per render
                  key={wordIndex}
                  className={cx('inline-flex', splitLevelClassName)}
                >
                  {wordObj.characters.map((char, charIndex) => {
                    const transitionWithDelay = {
                      ...transition,
                      delay: getStaggerDelay(
                        previousCharsCount + charIndex,
                        array.reduce((sum, w) => sum + w.characters.length, 0),
                      ),
                    }
                    return (
                      <motion.span
                        // biome-ignore lint/suspicious/noArrayIndexKey: chars are transient per render
                        key={charIndex}
                        initial={prefersReducedMotion ? false : initial}
                        animate={animate}
                        {...(prefersReducedMotion ? {} : { exit })}
                        transition={transitionWithDelay}
                        className={cx('inline-block', elementLevelClassName)}
                      >
                        {char}
                      </motion.span>
                    )
                  })}
                  {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
                </span>
              )
            })}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    )
  },
)

RotatingText.displayName = 'RotatingText'
export default RotatingText
export { RotatingText }
