import { Link, NavLink, Outlet } from 'react-router';
import { useMe, useSignOut } from '../auth';

export function Layout() {
  const me = useMe();
  const signOut = useSignOut();

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          Classifieds <span className="brand-sub">Merchant</span>
        </Link>
        {me.data && (
          <>
            <nav className="app-nav" aria-label="Main">
              <NavLink to="/" end>
                My listings
              </NavLink>
              <NavLink to="/listings/new">New listing</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </nav>
            <div className="app-user">
              <span className="muted">{me.data.name}</span>
              <button
                type="button"
                className="button"
                onClick={() => signOut.mutate()}
                disabled={signOut.isPending}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
