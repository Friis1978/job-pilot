---
name: InsForge SSR Package Location
description: @insforge/ssr does not exist; SSR utilities live in @insforge/sdk/ssr subpath export
type: project
---

`@insforge/ssr` does NOT exist on npm. The SSR utilities are exported from `@insforge/sdk/ssr`.

**Why:** Architecture.md was written using a Supabase analogy — Supabase has `@supabase/ssr` but InsForge ships everything in one package.

**How to apply:** Always import SSR utilities as:
```typescript
import { createBrowserClient, createServerClient, updateSession } from "@insforge/sdk/ssr";
```

Cookie names (from SSR types):
- Access token: `insforge_access_token`
- Refresh token: `insforge_refresh_token`

Next.js middleware cookie adapters: `RequestCookies`/`ResponseCookies` types don't exactly match InsForge `CookieStore` overload signatures — use `as any` cast (runtime is correct).
