"use client";

import { useEffect } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A manual display unit. Renders only when both a client id and an ad-unit slot id are set;
 * without a slot id the site relies on AdSense Auto ads (loaded in the root layout).
 */
export function AdSlot() {
  useEffect(() => {
    if (!CLIENT || !SLOT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);
  if (!CLIENT || !SLOT) return null;
  return (
    <div className="ad" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
