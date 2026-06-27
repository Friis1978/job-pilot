export function useRouter() {
  return { push:()=>{}, replace:()=>{}, back:()=>{}, forward:()=>{}, refresh:()=>{}, prefetch:()=>{} };
}
export function usePathname() { return '/'; }
export function useParams() { return {}; }
export function useSearchParams() { return { get:()=>null, has:()=>false, toString:()=>'', [Symbol.iterator]:function*(){} }; }
export function redirect() {}
export function notFound() {}
export function useSelectedLayoutSegment() { return null; }
export function useSelectedLayoutSegments() { return []; }
