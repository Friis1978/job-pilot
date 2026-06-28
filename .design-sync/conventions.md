# JobPilot Design System — Conventions

## Wrapping
No provider or context wrapper required. Components are standalone — they render with only `window.JobPilot.<Name>` and the bundled styles. `next/image`, `next/link`, and `next/navigation` are mocked inside the bundle so routing hooks never throw.

## Styling idiom — Tailwind v4 with semantic tokens

This design system uses Tailwind CSS v4. **Always compose layout glue from the token vocabulary below; never hardcode hex values or raw color names.**

### Surface / background
| Class | Role |
|---|---|
| `bg-background` | Page background (off-white / light base) |
| `bg-surface` | Cards and elevated panels |
| `bg-surface-muted` | Subtle inset blocks, code areas |
| `bg-surface-secondary` | Secondary cards |
| `bg-surface-tertiary` | Tertiary / deepest inset |

### Accent (brand blue)
| Class | Role |
|---|---|
| `bg-accent` | Primary action fill |
| `bg-accent-dark` | Hover / active state for accent |
| `bg-accent-light` | Accent tint (hover backgrounds) |
| `bg-accent-muted` | Very subtle accent wash |
| `text-accent` | Accent text / links |
| `border-accent` | Accent border (focus rings, highlights) |
| `bg-accent-foreground` | Text on solid accent buttons |

### Text
| Class | Role |
|---|---|
| `text-text-primary` | Body and heading copy |
| `text-text-secondary` | Supporting / de-emphasised copy |
| `text-text-muted` | Placeholder, disabled, captions |

### Borders
| Class | Role |
|---|---|
| `border-border` | Default dividers and input outlines |
| `border-border-light` | Lighter rule |
| `border-border-muted` | Subtle separator |

### Status
`bg-success`, `bg-error`, `bg-warning`, `bg-info` — each has a matching `text-*-foreground` and lighter variants `bg-*-light`, `bg-*-lightest`.

### Typography
Font family tokens: `font-sans` (Inter, served via Google Fonts at runtime) and `font-mono`. Use standard Tailwind size/weight scale (`text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl` … `text-4xl`; `font-medium`, `font-semibold`, `font-bold`).

## Where the truth lives
- **Token definitions**: `styles.css` → `_ds_bundle.css` (the full compiled token set is in `_ds_bundle.css`, imported by `styles.css`)
- **Component API**: `components/<group>/<Name>/<Name>.d.ts` (TypeScript props interface)
- **Component usage guide**: `components/<group>/<Name>/<Name>.prompt.md`

Always read the `.d.ts` for a component before writing props — every prop name and type is there.

## Idiomatic build snippet

```jsx
import { Navbar, StatsBar, JobsTable, StatusBadge } from 'job_pilot';

export function FindJobsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar user={{ name: 'Rasmus Hansen', avatarUrl: null }} isAdmin={false} />
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        <StatsBar totalJobs={48} avgMatchScore={71} topMatchScore={94} pendingResearch={3} />
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <JobsTable jobs={jobs} onJobClick={(id) => {}} isLoading={false} />
        </div>
      </main>
    </div>
  );
}
```

Layout glue (`min-h-screen`, `max-w-7xl`, `px-6`, `py-8`, `rounded-xl`) uses standard Tailwind utilities. Token classes (`bg-background`, `bg-surface`, `border-border`) come from the design system's token layer. Components themselves handle their internal layout — only supply outer sizing and spacing.
