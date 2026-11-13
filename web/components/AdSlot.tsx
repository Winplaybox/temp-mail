"use client";

import { useEffect } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT is set. */
export function AdSlot({ slot }: { slot: string }) {
  useEffect(() => {
    if (!CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);
  if (!CLIENT) return null;
  return (
    <div className="ad" data-slot-name={slot}>
      <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={CLIENT} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
