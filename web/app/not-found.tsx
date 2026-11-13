import Link from "next/link";

export default function NotFound() {
  return (
    <article className="prose">
      <h1>This page doesn't exist</h1>
      <p>
        Your inbox is on the <Link href="/">home page</Link>.
      </p>
    </article>
  );
}
