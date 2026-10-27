import * as React from 'react';
const Ctx = React.createContext<any>(null);
export function MemoryRouter({ initial, children }: any) {
  const [path, setPath] = React.useState(initial);
  const navigate = React.useCallback((to: string) => { setPath(to); (window as any).__path = to; }, []);
  (window as any).__path = path;
  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}
export const useLocation = () => ({ pathname: React.useContext(Ctx).path });
export const useNavigate = () => React.useContext(Ctx).navigate;
export function Link({ to, children, ...rest }: any) {
  const { navigate } = React.useContext(Ctx);
  return <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }} {...rest}>{children}</a>;
}
export function NavLink({ to, end, className, children, onClick, ...rest }: any) {
  const { path, navigate } = React.useContext(Ctx);
  const active = end ? path === to : path === to || path.startsWith(to + '/');
  return <a href={to} aria-current={active ? 'page' : undefined} className={typeof className === 'function' ? className({ isActive: active }) : className}
    onClick={(e) => { e.preventDefault(); onClick?.(e); navigate(to); }} {...rest}>{children}</a>;
}
export function Outlet() {
  const { path } = React.useContext(Ctx);
  return <div><h1>Page {path}</h1>{Array.from({ length: 14 }, (_, i) => <p key={i}>Filler paragraph {i} so the page scrolls under the HUD and the hotbar.</p>)}
    <label>Last field <input id="last-field" /></label></div>;
}
