import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="notice">
      <h1>Page not found</h1>
      <p>The listing may have been removed, or the link is wrong.</p>
      <Link href="/">Back to all listings</Link>
    </div>
  );
}
