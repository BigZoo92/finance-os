import { definePreset } from '@pandacss/dev'

/**
 * Finance-OS — Command Pixel V1 design tokens.
 *
 * Canonical palette: Soft Orange Cream. Warm graphite / brown-black dark
 * foundations, cream text, signal orange as the signature accent. Financial
 * semantics (positive, warning, negative) are always separate from the brand
 * color; teal is a contained secondary support. Dark mode is canonical, light
 * mode is a native warm cream with ink graphite.
 *
 * Canonical values: .design/command-pixel-v1/tokens/design-tokens.json
 * Visual source of truth: DESIGN.md
 *
 * Every color is a semantic token with a `base` (light) and `_dark` value; the
 * `.dark` class on <html> selects the dark set (see apps/web/src/lib/theme.ts).
 */

const color = (light: string, dark: string) => ({ value: { base: light, _dark: dark } })

export const financeOsPreset = definePreset({
  name: '@finance-os/panda-preset',
  theme: {
    extend: {
      tokens: {
        fonts: {
          sans: {
            value: '"Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
          },
          mono: {
            value: '"Geist Mono Variable", "Geist Mono", ui-monospace, "SFMono-Regular", monospace',
          },
          pixel: { value: '"Geist Pixel", "Geist Mono Variable", ui-monospace, monospace' },
        },
        // Restrained radius ladder: tile 6, icon tile 7, control 8, dropdown 10,
        // surface 12, frame 14. 14px is the maximum for standard product surfaces.
        radii: {
          sm: { value: '6px' },
          md: { value: '8px' },
          lg: { value: '12px' },
          xl: { value: '14px' },
          '2xl': { value: '14px' },
          '3xl': { value: '14px' },
          tile: { value: '6px' },
          iconTile: { value: '7px' },
          control: { value: '8px' },
          dropdown: { value: '10px' },
          surface: { value: '12px' },
          frame: { value: '14px' },
        },
        // Tailwind 4 `text-*` line heights as unitless ratios. They stay CSS variables
        // on purpose: the minifier folds a bare `calc(1 / 0.75)` into 1.33333, which
        // makes a 12px line box 15.98px tall instead of 16px and shifts every screen.
        lineHeights: {
          xs: { value: 'calc(1 / 0.75)' },
          sm: { value: 'calc(1.25 / 0.875)' },
          md: { value: 'calc(1.5 / 1)' },
          lg: { value: 'calc(1.75 / 1.125)' },
          xl: { value: 'calc(1.75 / 1.25)' },
          '2xl': { value: 'calc(2 / 1.5)' },
          '3xl': { value: 'calc(2.25 / 1.875)' },
          '4xl': { value: 'calc(2.5 / 2.25)' },
        },
        easings: {
          outExpo: { value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          outQuart: { value: 'cubic-bezier(0.25, 1, 0.5, 1)' },
          inOutQuart: { value: 'cubic-bezier(0.76, 0, 0.24, 1)' },
        },
        // Canonical functional range is 120 to 180 ms.
        durations: {
          fast: { value: '120ms' },
          normal: { value: '180ms' },
          slow: { value: '350ms' },
          enter: { value: '280ms' },
          exit: { value: '180ms' },
        },
        // Restrained neutral shadows, no brand glow.
        shadows: {
          xs: { value: '0 1px 2px oklch(0 0 0 / 6%)' },
          sm: { value: '0 1px 3px oklch(0 0 0 / 10%), 0 1px 2px oklch(0 0 0 / 5%)' },
          md: { value: '0 4px 10px oklch(0 0 0 / 8%), 0 2px 4px oklch(0 0 0 / 4%)' },
          lg: { value: '0 12px 28px oklch(0 0 0 / 10%), 0 4px 8px oklch(0 0 0 / 4%)' },
          xl: { value: '0 24px 48px oklch(0 0 0 / 14%), 0 8px 16px oklch(0 0 0 / 6%)' },
          // Elevation semantics: base surface, raised control, floating popover, overlay.
          surface: { value: '0 1px 3px oklch(0 0 0 / 10%), 0 1px 2px oklch(0 0 0 / 5%)' },
          raised: { value: '0 4px 10px oklch(0 0 0 / 8%), 0 2px 4px oklch(0 0 0 / 4%)' },
          floating: { value: '0 12px 28px oklch(0 0 0 / 10%), 0 4px 8px oklch(0 0 0 / 4%)' },
          overlay: { value: '0 24px 48px oklch(0 0 0 / 14%), 0 8px 16px oklch(0 0 0 / 6%)' },
        },
        zIndex: {
          navbar: { value: 30 },
          mobileNav: { value: 30 },
          dropdown: { value: 40 },
          popover: { value: 50 },
          drawer: { value: 60 },
          modal: { value: 70 },
          toast: { value: 80 },
        },
      },
      semanticTokens: {
        colors: {
          background: color('#f5efe3', '#242019'),
          foreground: color('#221e17', '#f6f1e6'),
          card: { DEFAULT: color('#fcfaf4', '#2c2720'), foreground: color('#221e17', '#f6f1e6') },
          popover: {
            DEFAULT: color('#ffffff', '#302b23'),
            foreground: color('#221e17', '#f6f1e6'),
          },
          // Surface depth: canvas, surface, raised / floating, high.
          surface: {
            0: color('#f5efe3', '#242019'),
            1: color('#fcfaf4', '#2c2720'),
            2: color('#ffffff', '#302b23'),
            3: color('#ffffff', '#363026'),
          },
          // Primary: signal orange.
          primary: {
            DEFAULT: color('#de5e1e', '#f97a3c'),
            foreground: color('#fff9f0', '#241c10'),
          },
          secondary: {
            DEFAULT: color('#ede5d1', '#363026'),
            foreground: color('#221e17', '#f6f1e6'),
          },
          muted: { DEFAULT: color('#ece4d2', '#322c24'), foreground: color('#5e5748', '#a89e8b') },
          // Brand-adjacent hover surface.
          accent: { DEFAULT: color('#f3e3d0', '#3a2f22'), foreground: color('#3a2a1a', '#f6f1e6') },
          // Coral, genuine error states only.
          destructive: {
            DEFAULT: color('#b23e2c', '#e0685a'),
            foreground: color('#fbf5ec', '#241512'),
          },
          // Contour lines at ~16%.
          border: color('#221e1729', '#f6f1e629'),
          input: color('#221e1738', '#f6f1e638'),
          ring: color('#de5e1e', '#f97a3c'),
          // Financial semantics: never the brand color.
          positive: color('#1c8a52', '#4cbb82'),
          negative: color('#b23e2c', '#e0685a'),
          warning: color('#a97614', '#d9a441'),
          // Canonical support accents.
          teal: color('#3e8578', '#6fb5aa'),
          warmAccent: color('#9c8557', '#dccba6'),
          ai: color('#6c5bd4', '#9b8ce8'),
          // Chart palette: orange, teal, warm accent, green, amber, coral, AI violet (rare).
          chart: {
            1: color('#de5e1e', '#f97a3c'),
            2: color('#3e8578', '#6fb5aa'),
            3: color('#9c8557', '#dccba6'),
            4: color('#1c8a52', '#4cbb82'),
            5: color('#a97614', '#d9a441'),
            6: color('#b23e2c', '#e0685a'),
            7: color('#6c5bd4', '#9b8ce8'),
          },
          // Login uses a deeper signature canvas than the application shell.
          login: {
            canvas: {
              center: color('#fcf7eb', '#1e1810'),
              mid: color('#f5efe3', '#141109'),
              edge: color('#eae0cc', '#0e0b07'),
            },
            panel: color('#f7f0e4', '#26211a'),
            field: color('#eee4d3', '#1c1710'),
          },
          // Radar immersive canvas: the only full-frame signature wash outside Mémoire.
          radar: {
            canvas: {
              center: color('#fcf7eb', '#211b12'),
              mid: color('#f5efe3', '#17130e'),
              edge: color('#ede4d2', '#110e09'),
            },
          },
        },
      },
      // Text styles pair size and line height exactly like the Tailwind `text-*`
      // utilities they replace (unitless ratios through the lineHeights tokens, so
      // nested elements with another font size inherit a scaled line box).
      textStyles: {
        xs: { value: { fontSize: '0.75rem', lineHeight: '{lineHeights.xs}' } },
        sm: { value: { fontSize: '0.875rem', lineHeight: '{lineHeights.sm}' } },
        md: { value: { fontSize: '1rem', lineHeight: '{lineHeights.md}' } },
        lg: { value: { fontSize: '1.125rem', lineHeight: '{lineHeights.lg}' } },
        xl: { value: { fontSize: '1.25rem', lineHeight: '{lineHeights.xl}' } },
        '2xl': { value: { fontSize: '1.5rem', lineHeight: '{lineHeights.2xl}' } },
        '3xl': { value: { fontSize: '1.875rem', lineHeight: '{lineHeights.3xl}' } },
        '4xl': { value: { fontSize: '2.25rem', lineHeight: '{lineHeights.4xl}' } },
        '5xl': { value: { fontSize: '3rem', lineHeight: '1' } },
        '6xl': { value: { fontSize: '3.75rem', lineHeight: '1' } },
        // Monetary amounts: mono, tabular, slashed zero.
        financial: {
          value: {
            fontFamily: 'mono',
            fontFeatureSettings: '"tnum", "zero", "ss01"',
            letterSpacing: '-0.01em',
          },
        },
        // Tabular numerics in sans, for dashboards.
        tnum: { value: { fontFeatureSettings: '"tnum", "zero"' } },
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        // Overlay motion (former tw-animate-css classes).
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
        slideInFromBottom: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        slideOutToBottom: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        slideInFromRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideOutToRight: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        // Popover / tooltip side offsets (0.5rem nudge with fade).
        nudgeFromTop: {
          from: { opacity: '0', transform: 'translateY(-0.5rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        nudgeFromBottom: {
          from: { opacity: '0', transform: 'translateY(0.5rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        nudgeFromLeft: {
          from: { opacity: '0', transform: 'translateX(-0.5rem)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        nudgeFromRight: {
          from: { opacity: '0', transform: 'translateX(0.5rem)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        loginReveal: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        loginActivity: {
          '0%, 100%': { opacity: '0.28', transform: 'scaleY(0.7)' },
          '50%': { opacity: '1', transform: 'scaleY(1)' },
        },
      },
    },
  },
})

export default financeOsPreset
