import { RootShell } from "@/components/RootShell";
import { baseMetadata, baseViewport } from "@/lib/meta";

export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
