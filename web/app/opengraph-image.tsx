import { ImageResponse } from "next/og";

export const alt = "WinPlayBox Temp Mail — free temporary email";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  const stripe =
    "repeating-linear-gradient(-45deg, #d62839 0 28px, #ffffff 28px 40px, #1e4fd8 40px 68px, #ffffff 68px 80px)";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 22, background: stripe }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#0f2238",
            borderRadius: 10,
            padding: "56px 64px",
            color: "#eaf1f9",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: "#92a7be" }}>WinPlayBox Temp Mail</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Free temporary email</div>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>that receives in seconds</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36 }}>
            <span style={{ color: "#eaf1f9" }}>quick.zebra526</span>
            <span style={{ color: "#ff6170", marginLeft: -14, marginRight: -14 }}>@</span>
            <span style={{ color: "#86a6ff" }}>buzzstormnow.com</span>
            <span
              style={{
                marginLeft: "auto",
                background: "#ffd25c",
                color: "#2e2200",
                padding: "8px 18px",
                borderRadius: 8,
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              OTP 918273
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
