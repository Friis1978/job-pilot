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
**Pattern:** `bg-surface border-b border-border` header with responsive height/padding (`py-3 sm:h-16 sm:py-0`). Inner container uses `flex-wrap` on mobile and returns to single row on larger screens. Nav uses `order-3 w-full justify-center` on mobile and `sm:order-0 sm:w-auto` on larger screens. Nav links scale `text-xs sm:text-sm`. CTA scales `text-xs sm:text-sm` with `px-3 sm:px-4`.

### Footer
**File:** `components/layout/Footer.tsx`
**Pattern:** `bg-surface border-t border-border` with mobile wrap (`py-4 sm:h-16 sm:py-0`, `flex-wrap`). Footer nav mirrors navbar responsive behavior (`order-3 w-full justify-center` on mobile). Links scale `text-xs sm:text-sm text-text-secondary hover:text-text-primary`.

### Hero
**File:** `components/homepage/Hero.tsx`
**Pattern:** `hero-gradient` card with responsive padding (`px-4 sm:px-8`, `pt-12 sm:pt-16`, `pb-10 sm:pb-14`). Headline scales `text-3xl sm:text-5xl`. CTA group stacks on mobile (`flex-col w-full max-w-xl`) and switches to row on larger screens (`sm:flex-row`). CTA buttons use `w-full sm:w-auto`.

### HowItWorks
**File:** `components/homepage/HowItWorks.tsx`
**Pattern:** card with responsive spacing and muted canvas (`bg-surface-muted`, `px-6 sm:px-10 lg:px-12`, `py-12 sm:py-16 lg:py-20`). Grid is mobile-first `grid-cols-1 lg:grid-cols-2` with `gap-10 lg:gap-20`. Heading scales `text-3xl sm:text-4xl`. Feature list block is white (`bg-surface border border-border`) with row separators and accent left border on the first item.

### Features
**File:** `components/homepage/Features.tsx`
**Pattern:** same responsive card and grid strategy as HowItWorks, using muted card background (`bg-surface-muted`) with `grid-cols-1 lg:grid-cols-2` and responsive px/py/gap. Heading scales `text-3xl sm:text-4xl`.

### Testimonial
**File:** `components/homepage/Testimonial.tsx`
**Pattern:** `bg-surface py-24`, centered. Label: `text-xs font-semibold uppercase tracking-widest text-accent`. Quote: class-based typography `font-medium text-text-primary text-2xl leading-[1.45]` (no inline style). Attribution: `Image` 40×40 `rounded-full` + name `text-sm font-semibold` + role `text-xs text-text-muted`.

### BottomCTA
**File:** `components/homepage/BottomCTA.tsx`
**Pattern:** `hero-gradient` with responsive spacing (`py-14 sm:py-20`, `px-5 sm:px-8`). Heading scales `text-3xl sm:text-4xl`. CTA group follows Hero responsive stack pattern (`flex-col sm:flex-row`, `w-full sm:w-auto` buttons).

### CompletionIndicator
**File:** `components/profile/CompletionIndicator.tsx`
**Pattern:** Server component. `flex items-start justify-between gap-6` layout. Left: warning icon SVG (orange, 20×20) + heading + description + orange pill badges (`bg-warning/10 text-warning rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide`). Right: `relative w-[88px] h-[88px]` container with SVG donut ring (`rotate(-90 50 50)` transform, orange `#FF8904` stroke, gray `#E7EAF3` track, `strokeDasharray`/`strokeDashoffset` for percentage) + absolutely positioned `%` text overlay.

### ResumeUpload
**File:** `components/profile/ResumeUpload.tsx`
**Pattern:** Client component (`"use client"`). Card with dashed upload zone (`border-2 border-dashed border-border rounded-xl`, hover `border-accent/50`, drag-active `border-accent bg-accent-muted`). Hidden `<input type="file" accept=".pdf">` triggered by click/drop. Bottom row: `flex items-center justify-between` with muted text left, accent `Generate Resume from Profile` button right.

### ProfileForm
**File:** `components/profile/ProfileForm.tsx`
**Pattern:** Client component (`"use client"`). Single card with 5 subsections separated by `border-t border-border` + `SectionDivider` helper. Labels: `text-xs font-medium uppercase tracking-wide text-text-secondary`. Inputs: `border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent`. Selects: same + `appearance-none` + custom chevron SVG overlay. Tag inputs: text input + Add button row, tags as `bg-surface-secondary border border-border rounded-full px-3 py-1` pills with × SVG remove button. Work experience: array of role cards (`border border-border rounded-xl p-4`) with add/remove. Save Profile: `w-full py-3 bg-accent text-accent-foreground rounded-lg` at bottom.

### SearchCard (Find Jobs)
**File:** `components/find-jobs/SearchCard.tsx`
**Pattern:** Client component (`"use client"`). `bg-surface border border-border rounded-2xl p-6 shadow-sm` card. Inputs row uses `flex items-end gap-4` — JOB TITLE has left-icon search SVG (pl-9), LOCATION has no icon. Labels: `text-xs font-medium uppercase tracking-wide text-text-secondary`. Find Jobs button: `bg-accent text-accent-foreground rounded-lg px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed`. Button text is "Searching..." while loading. Success banner: conditional on `result !== null` — `mt-4 rounded-xl bg-success-lightest px-4 py-3 flex items-center gap-3` with sparkle SVG icon and `text-sm font-medium text-success-foreground` text showing real counts. Error: `mt-3 text-sm text-error`.

### JobsTable (Find Jobs)
**File:** `components/find-jobs/JobsTable.tsx`
**Last updated:** 2026-06-10

**Pattern:** Client component (`"use client"`). Returns two cards: (1) Filter bar — `bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm` with search icon + borderless input + control buttons right-aligned in `flex items-center gap-2 shrink-0`. (2) Table card — `bg-surface border border-border rounded-2xl overflow-hidden shadow-sm`. Table uses `<table>` with `w-[22%/28%/24%/16%/10%]` column widths. Headers: `px-6 py-4 text-xs font-medium uppercase tracking-wide text-text-secondary`. Rows: `hover:bg-surface-secondary transition-colors cursor-pointer border-b border-border`. Company cell: `w-9 h-9 bg-surface-secondary border border-border rounded-lg` icon container + `font-semibold text-sm`. Match score: `w-32 h-1 bg-border rounded-full` track + colored fill (≥90% `bg-success`, ≥80% `bg-info`, else `bg-warning`) with inline `width: score%`. Pagination: `px-6 py-4 flex items-center justify-between border-t border-border` with `border border-border rounded-lg px-3 py-1.5` page buttons, active page gets `font-semibold bg-surface-secondary`.

**Filter/sort buttons (inactive):** `border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors`
**Filter/sort buttons (active):** `border-accent text-accent bg-accent-muted`

**Destructive button (Clear all):** Only rendered when `jobs.length > 0`. Two-state: default `border-border text-text-secondary hover:bg-surface-secondary`; confirm state `border-error text-error bg-surface-secondary`. Text transitions: "Clear all" → "Confirm clear" → "Clearing...". Resets on blur via `onBlur`. Disabled with `opacity-50 cursor-not-allowed` while request is in flight. Icon: trash SVG `w-3.5 h-3.5` left of label.

**Pattern note:** Destructive actions use `text-error` + `border-error` for the confirm state — no dedicated error background token exists, use `bg-surface-secondary` as the confirm highlight.

### ResearchButton (Find Jobs / Job Details)
**File:** `components/find-jobs/ResearchButton.tsx`
**Pattern:** Client component (`"use client"`). Props: `{ jobId: string }`. Wrapper: `flex flex-col items-end gap-2`. Button: `flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors`. Loading/done state appends `opacity-60 cursor-not-allowed`. Hover (when enabled): `hover:bg-accent-dark`. Text: "Research Company" → "Researching..." → "Research Complete". SearchIcon SVG defined inline (same path as in page.tsx). Error: `text-sm text-error` below the button. On success: `setDone(true)` then `router.refresh()` — server component re-fetches, company_research now non-null, conditional flips to show dossier, button disappears.
