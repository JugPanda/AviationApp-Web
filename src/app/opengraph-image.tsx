import { ImageResponse } from "next/og";
export const alt = "AV Weather — Your preflight workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#0b1721",
          padding: 70,
          color: "#f1f0e8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
          }}
        >
          <span>AV Weather</span>
          <span style={{ fontSize: 15, color: "#ffad66" }}>
            PILOT-BUILT / PUBLIC PREVIEW
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            letterSpacing: -4,
            lineHeight: 1.12,
          }}
        >
          <span>Your preflight workspace.</span>
          <span style={{ color: "#a4c9d5" }}>On the device you have.</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 19,
            color: "#b7c4cb",
            borderTop: "1px solid #435762",
            paddingTop: 25,
          }}
        >
          <span>Weather. Planning. Pilot tools.</span>
          <span>In your browser. On your devices.</span>
        </div>
      </div>
    ),
    size,
  );
}
