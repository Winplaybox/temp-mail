"""python -m tempmail_worker  — reads settings from environment variables."""
import os
import sys

from .jobs import Settings, run_all


def main() -> int:
    # All secrets are optional: without them only the public checks run
    # (site health + create/delete an address). Cleanup also runs in Supabase pg_cron.
    s = Settings(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
        server_secret=os.getenv("TEMPMAIL_SERVER_SECRET", ""),
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
