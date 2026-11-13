import { randomInt } from "node:crypto";

const ADJECTIVES = [
  "brisk", "calm", "clever", "cosmic", "crisp", "daring", "dusky", "eager", "fancy", "fuzzy",
  "gentle", "golden", "happy", "humble", "jolly", "lucky", "mellow", "misty", "nimble", "noble",
  "plucky", "quick", "quiet", "rapid", "rusty", "shiny", "silent", "snappy", "sunny", "swift",
  "tidy", "vivid", "witty", "zesty", "breezy", "chirpy", "frosty", "lively", "peppy", "spicy",
];
const NOUNS = [
  "otter", "falcon", "mango", "tiger", "comet", "panda", "lotus", "koala", "parrot", "pebble",
  "rocket", "maple", "badger", "cobra", "dolphin", "gecko", "heron", "jaguar", "lemur", "mantis",
  "nectar", "orbit", "peacock", "quokka", "raven", "sparrow", "tulip", "walrus", "yak", "zebra",
  "chai", "samosa", "kite", "monsoon", "banyan", "cricket", "ladoo", "bulbul", "mynah", "neem",
];

const LOCAL_PART_RE = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;

const RESERVED = new Set([
  "admin", "administrator", "root", "postmaster", "abuse", "hostmaster", "webmaster", "support",
  "security", "noreply", "no-reply", "info", "billing", "help", "mailer-daemon", "sagar",
  "winplaybox", "official", "contact", "sales", "privacy", "legal",
]);

const pick = <T,>(list: T[]): T => list[randomInt(list.length)];

export function randomLocalPart(): string {
  return `${pick(ADJECTIVES)}.${pick(NOUNS)}${randomInt(100, 1000)}`;
}

/** Returns an error message, or null when the name is usable. */
export function validateLocalPart(value: string): string | null {
  if (!LOCAL_PART_RE.test(value)) {
    return "Use 4–32 characters: letters, numbers, dot, dash or underscore. Start and end with a letter or number.";
  }
  if (value.includes("..") || value.includes("--")) return "Don't repeat dots or dashes.";
  if (RESERVED.has(value)) return "This name is reserved. Pick another one.";
  return null;
}
