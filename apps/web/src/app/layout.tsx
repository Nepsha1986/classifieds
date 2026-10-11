import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl } from '../config';
import './globals.css';

// Every page shows live listings, so render on each request rather than at build time (the API is
// not reachable during a Docker build anyway).
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return {
    // Read per request so one build serves any domain (relative canonical/OG URLs resolve against it).
    metadataBase: new URL(siteUrl()),
    title: { default: 'Classifieds', template: '%s · Classifieds' },
    description: 'Buy and sell locally: browse and search classified listings.',
    openGraph: { siteName: 'Classifieds', type: 'website' },
  };
}

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
