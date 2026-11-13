import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WinPlayBox Temp Mail",
    short_name: "Temp Mail",
    description: "Free temporary email that receives in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8eef5",
    theme_color: "#1e4fd8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
