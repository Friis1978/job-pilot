// Stubs for Next.js APIs used by JobPilot components in standalone preview context
import { forwardRef, createElement } from 'react';

// next/navigation stubs
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
    pathname: '/',
  };
}
export function usePathname() { return '/'; }
export function useParams() { return {}; }
export function useSearchParams() {
  return {
    get: () => null,
    getAll: () => [],
    has: () => false,
    toString: () => '',
    entries: () => [][Symbol.iterator](),
    keys: () => [][Symbol.iterator](),
    values: () => [][Symbol.iterator](),
    forEach: () => {},
    [Symbol.iterator]: function* () {},
  };
}
export function redirect() {}
export function notFound() {}
export function useSelectedLayoutSegment() { return null; }
export function useSelectedLayoutSegments() { return []; }

// next/link stub — renders a plain <a>
export default forwardRef(function Link({ href, children, className, onClick, prefetch: _p, ...rest }, ref) {
  return createElement('a', { href: typeof href === 'string' ? href : '/', className, onClick, ref, ...rest }, children);
});

// next/image stub — renders a plain <img>
export function Image({ src, alt, width, height, className, style, priority: _p, ...rest }) {
  return createElement('img', { src, alt, width, height, className, style, ...rest });
}
