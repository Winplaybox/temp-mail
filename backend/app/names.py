import re
import secrets

ADJECTIVES = [
    "brisk", "calm", "clever", "cosmic", "crisp", "daring", "dusky", "eager", "fancy", "fuzzy",
    "gentle", "golden", "happy", "humble", "jolly", "lucky", "mellow", "misty", "nimble", "noble",
    "plucky", "quick", "quiet", "rapid", "rusty", "shiny", "silent", "snappy", "sunny", "swift",
    "tidy", "vivid", "witty", "zesty", "breezy", "chirpy", "frosty", "lively", "peppy", "spicy",
]
NOUNS = [
    "otter", "falcon", "mango", "tiger", "comet", "panda", "lotus", "koala", "parrot", "pebble",
    "rocket", "maple", "badger", "cobra", "dolphin", "gecko", "heron", "jaguar", "lemur", "mantis",
    "nectar", "orbit", "peacock", "quokka", "raven", "sparrow", "tulip", "walrus", "yak", "zebra",
    "chai", "samosa", "kite", "monsoon", "banyan", "cricket", "ladoo", "bulbul", "mynah", "neem",
]

LOCAL_PART_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$")

RESERVED = {
    "admin", "administrator", "root", "postmaster", "abuse", "hostmaster", "webmaster", "support",
    "security", "noreply", "no-reply", "info", "billing", "help", "mailer-daemon", "sagar",
    "winplaybox", "official", "contact", "sales", "privacy", "legal",
}


def random_local_part() -> str:
    return f"{secrets.choice(ADJECTIVES)}.{secrets.choice(NOUNS)}{secrets.randbelow(900) + 100}"


def normalize_local_part(value: str) -> str:
    return value.strip().lower()


def validate_local_part(value: str) -> str | None:
    """Return an error message, or None when the name is usable."""
    if not LOCAL_PART_RE.match(value):
        return "Use 4–32 characters: letters, numbers, dot, dash or underscore. Start and end with a letter or number."
    if ".." in value or "--" in value:
        return "Don't repeat dots or dashes."
    if value in RESERVED:
        return "This name is reserved. Pick another one."
    return None
