---
name: Forma Editorial System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#43474e'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#002045'
  on-primary: '#ffffff'
  primary-container: '#1a365d'
  on-primary-container: '#86a0cd'
  inverse-primary: '#adc7f7'
  secondary: '#ab3500'
  on-secondary: '#ffffff'
  secondary-container: '#fe6a34'
  on-secondary-container: '#5d1900'
  tertiary: '#04270f'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c3d23'
  on-tertiary-container: '#83a886'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f7'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#c5edc7'
  tertiary-fixed-dim: '#aad0ac'
  on-tertiary-fixed: '#00210a'
  on-tertiary-fixed-variant: '#2c4e32'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system establishes a **Sports-Science Editorial** aesthetic. It balances the precision of technical documentation with the tactile, premium feel of a physical sports journal. The UI targets dedicated athletes and fitness enthusiasts who value data-driven insights over gamification.

The style is a hybrid of **Minimalism** and **Structured Grid-layouts**. It utilizes heavy whitespace, disciplined typography, and subtle technical accents—such as thin hairlines and monospaced data points—to evoke an emotional response of focus, authority, and reliability. The visual language is calm but rigorous, prioritizing legibility and a sense of "premium utility."

## Colors

The palette is anchored by a warm off-white background (#FDFCF8) to reduce eye strain and provide a "paper" feel.
- **Primary (Deep Cobalt):** Used for primary actions, active navigation states, and authoritative branding elements.
- **Secondary (Signal Orange):** Reserved for high-priority interactive states, active timers, or warnings. Use sparingly to maintain the editorial calm.
- **Tertiary (Soft Sage):** Indicates successful completion of sets, health metrics within range, or "rest" states.
- **Neutral (Graphite):** All primary text and iconography. Avoid pure black to maintain the premium editorial soft-contrast.
- **Surface Muted:** A gray-blue used for background fills on secondary UI elements like input fields and inactive chips.

## Typography

This design system uses **Geist** for its technical precision and systematic feel. The typographic hierarchy is strict:
- **Headings:** High contrast in weight (Bold/SemiBold) to separate sections clearly.
- **Spanish Localization:** Line heights are slightly increased (1.5x for body) to accommodate the typically longer word counts and character descenders in Spanish.
- **Data Display:** Use the `data-mono` role for rep counts, weights, and timestamps to ensure vertical alignment in lists.
- **Labels:** Uppercase labels are used for category headers and technical metadata to differentiate from conversational text.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a mobile-first philosophy. 
- **Mobile:** 4-column grid with 20px outer margins.
- **Desktop:** 12-column grid with a max-width of 1200px, centered.
- **Rhythm:** An 8px base grid drives all spatial relationships. Vertical spacing should be generous to maintain the "editorial" feel—use `stack-lg` between major content blocks.
- **Grid Lines:** Use 1px borders (#E2E8F0) to separate sections horizontally or vertically, mimicking a scientific notebook or ledger.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.
- **Base Layer:** The off-white background (#FDFCF8).
- **Surface Layer:** Content cards use pure white (#FFFFFF).
- **Outlines:** Use a 1px solid border (#E2E8F0) for all cards and containers.
- **Shadows:** Use a single, high-diffusion "Ambient Shadow" for floating elements or primary cards: `0px 4px 20px rgba(45, 45, 45, 0.05)`.
- **Interactive Depth:** When pressed, elements should shift slightly in background color (to #E2E8F0) rather than moving in Z-space.

## Shapes

The shape language is **Soft** but disciplined. 
- **Standard Radius:** 4px (0.25rem) for buttons, input fields, and small components to maintain a technical, engineered look.
- **Large Radius:** 8px (0.5rem) for content cards and modal containers.
- **Interactive Elements:** Checkboxes and radio buttons maintain sharp corners or very minimal rounding to stay consistent with the "technical form" aesthetic.

## Components

- **Buttons:** Primary buttons are Solid Cobalt (#1A365D) with white text. Secondary buttons use a Graphite outline. All buttons use `label-caps` for text.
- **Content Cards:** White background, 1px border (#E2E8F0), 8px corner radius. Used for workout summaries and exercise details.
- **Exercise Rows:** High-fidelity rows featuring `data-mono` for metrics (e.g., "12 REPS x 80 KG"). Use 1px bottom borders to separate rows in a list.
- **Segmented Controls:** Used for switching between "Vista de Lista" and "Gráficos." Fills the container width with a `surface-muted` background and white active indicator.
- **Filter Chips:** 4px radius, `surface-muted` background. Active state uses Cobalt background with white text.
- **Technical Badges:** Small, rectangular badges for "PR" (Personal Record) or "Nivel: Avanzado." Use Graphite background with white text, or Sage for success-related technical data.
- **Input Fields:** Minimalist design with a 1px bottom border only, or a subtle `surface-muted` fill. Focus state uses a Cobalt bottom border.
- **Conversational Interface:** Use subtle "notebook" style ruling (horizontal lines) to separate messages in the conversational flow.