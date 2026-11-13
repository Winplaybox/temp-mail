const paths: Record<string, string> = {
  copy: "M9 9h10v10H9zM5 15V5h10",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  shuffle: "M4 7h3l10 10h3M17 4l3 3-3 3M4 17h3l3-3M14 10l3-3h3M17 14l3 3-3 3",
  pen: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  back: "M15 5l-7 7 7 7",
  clip: "M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l7-7",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4",
  moon: "M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M4 4l2 2M18 18l2 2M1 12h3M20 12h3M4 20l2-2M18 6l2-2",
  image: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01",
  close: "M6 6l12 12M18 6L6 18",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      <path d={paths[name]} />
    </svg>
  );
}
