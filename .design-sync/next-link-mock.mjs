import { forwardRef, createElement } from 'react';
const Link = forwardRef(function Link({ href, children, className, onClick, prefetch: _p, replace: _r, scroll: _s, shallow: _sh, ...rest }, ref) {
  return createElement('a', { href: typeof href === 'string' ? href : (href?.pathname || '/'), className, onClick, ref, ...rest }, children);
});
export default Link;
