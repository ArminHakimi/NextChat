import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const size = Number((await params).size);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #bc4b51 0%, #7a2830 100%)",
          color: "#fff9f1",
          fontSize: size * 0.42,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        NC
      </div>
    ),
    { width: size, height: size },
  );
}
