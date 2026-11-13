import os
from dataclasses import dataclass, field


def _list(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    supabase_url: str = field(default_factory=lambda: os.getenv("SUPABASE_URL", "").rstrip("/"))
    supabase_service_key: str = field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_KEY", ""))
    allowed_origins: list[str] = field(
        default_factory=lambda: _list(
            "ALLOWED_ORIGINS", "https://temp-mail.winplaybox.in,http://localhost:3000"
        )
    )
    ip_salt: str = field(default_factory=lambda: os.getenv("IP_SALT", ""))
    cron_secret: str = field(default_factory=lambda: os.getenv("CRON_SECRET", ""))
    # Lifetimes the UI can pick (minutes) and the hard cap for one address.
    ttl_choices: tuple[int, ...] = (10, 60, 1440)
    default_ttl: int = 60
    max_lifetime_minutes: int = 7 * 24 * 60
    create_per_hour: int = int(os.getenv("CREATE_PER_HOUR", "15"))
    reads_per_minute: int = int(os.getenv("READS_PER_MINUTE", "180"))


settings = Settings()
