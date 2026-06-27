import { createElement } from 'react';
// Preview HTMLs are at components/<group>/<Name>/<Name>.html — 3 levels deep.
// Absolute /paths resolve to the page origin (claude.ai), not the project root.
// Rewrite them to relative paths so uploaded public assets are found.
const PREFIX = '../../../';
function resolvedSrc(src) {
  if (typeof src === 'string' && src.startsWith('/')) return PREFIX + src.slice(1);
  return src;
}
function Image({ src, alt, width, height, className, style, priority: _p, quality: _q, placeholder: _ph, blurDataURL: _b, fill: _f, sizes: _sz, loader: _l, unoptimized: _u, ...rest }) {
  return createElement('img', { src: resolvedSrc(src), alt, width, height, className, style, ...rest });
}
export default Image;
