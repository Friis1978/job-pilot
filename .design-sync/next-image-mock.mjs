import { createElement } from 'react';
function Image({ src, alt, width, height, className, style, priority: _p, quality: _q, placeholder: _ph, blurDataURL: _b, fill: _f, sizes: _sz, loader: _l, unoptimized: _u, ...rest }) {
  return createElement('img', { src, alt, width, height, className, style, ...rest });
}
export default Image;
