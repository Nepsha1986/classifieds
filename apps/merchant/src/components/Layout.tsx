import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          Classifieds <span className="brand-sub">Merchant</span>
        </Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
