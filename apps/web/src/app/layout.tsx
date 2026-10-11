import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

// Every page shows live listings, so render on each request rather than at build time (the API is
// not reachable during a Docker build anyway).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Classifieds', template: '%s · Classifieds' },
  description: 'Buy and sell locally: browse and search classified listings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="brand">
              Classifieds
            </Link>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">Classifieds — buy and sell locally.</div>
        </footer>
      </body>
    </html>
  );
}
