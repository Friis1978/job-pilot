# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Navbar
**File:** `components/layout/Navbar.tsx`
**Pattern:** `h-16 bg-surface border-b border-border` header, `max-w-[1440px] mx-auto px-6` inner container, logo is `Image` 36×36 + bold `text-text-darkest` at 19px. Nav links: `text-sm font-medium text-text-dark hover:text-accent`. CTA: `bg-text-primary text-surface text-sm font-medium px-4 py-2 rounded-md`.

### Footer
**File:** `components/layout/Footer.tsx`
**Pattern:** `bg-surface border-t border-border`, `max-w-[1440px] mx-auto px-8 py-6`, same logo as Navbar. Links: `text-sm text-text-secondary hover:text-text-primary`.

### Hero
**File:** `components/homepage/Hero.tsx`
**Pattern:** `hero-gradient` CSS class (defined in globals.css) for background. Headline: `font-bold text-text-primary` at 48px. Subheadline: `text-text-secondary text-base`. Primary CTA: `bg-text-primary text-surface text-sm font-medium px-5 py-2.5 rounded-md`. Secondary CTA: `bg-surface text-text-primary border border-border px-5 py-2.5 rounded-md`. Browser mockup uses `bg-surface rounded-t-xl border border-border shadow-lg` with a chrome bar showing traffic-light dots using `bg-error`, `bg-warning`, `bg-success`.

### HowItWorks
**File:** `components/homepage/HowItWorks.tsx`
**Pattern:** `bg-surface py-24`, two-column grid `grid-cols-2 gap-16 items-center`. Section heading: `font-bold text-text-primary` at 36px. Feature items: bold `text-sm font-semibold text-text-primary` title + `text-sm text-text-secondary` description. Screenshot in `rounded-2xl border border-border shadow-md overflow-hidden`.

### Features
**File:** `components/homepage/Features.tsx`
**Pattern:** `bg-surface-muted py-24`, two-column grid (image left, text right). Same heading/feature pattern as HowItWorks. Image in `rounded-xl overflow-hidden shadow-md border border-border`.

### Testimonial
**File:** `components/homepage/Testimonial.tsx`
**Pattern:** `bg-surface py-24`, centered. Label: `text-xs font-semibold uppercase tracking-widest text-accent`. Quote: `font-medium text-text-primary` at 24px. Attribution: `Image` 40×40 `rounded-full` + name `text-sm font-semibold` + role `text-xs text-text-muted`.

### BottomCTA
**File:** `components/homepage/BottomCTA.tsx`
**Pattern:** `hero-gradient py-24`, centered. Heading at 40px. Same CTA buttons as Hero.
