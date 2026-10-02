import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="not-found container">
      <h1 className="h2">This page does not exist.</h1>
      <p className="body-lg">
        <Link href="/">Go to the home page</Link>
      </p>
    </main>
  );
}
