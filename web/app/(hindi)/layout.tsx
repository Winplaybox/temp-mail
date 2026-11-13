import { RootShell } from "@/components/RootShell";
import { baseMetadata, baseViewport } from "@/lib/meta";

export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function HindiLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="hi">{children}</RootShell>;
}
