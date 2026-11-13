"""python -m tempmail_worker  — reads settings from environment variables."""
import os
import sys

from .jobs import Settings, run_all


def main() -> int:
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "TEMPMAIL_SERVER_SECRET") if not os.getenv(k)]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        return 2
    s = Settings(
        supabase_url=os.environ["SUPABASE_URL"],
        anon_key=os.environ["SUPABASE_ANON_KEY"],
        server_secret=os.environ["TEMPMAIL_SERVER_SECRET"],
        site_url=os.getenv("TEMPMAIL_SITE_URL", "https://temp-mail.winplaybox.in").rstrip("/"),
        ingest_secret=os.getenv("TEMPMAIL_INGEST_SECRET", ""),
    )
    report = run_all(s)
    text = report.markdown()
    print(text)
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text)
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
