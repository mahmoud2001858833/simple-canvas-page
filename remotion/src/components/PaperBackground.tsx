import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";

export const PaperBackground: React.FC = () => {
  const frame = useCurrentFrame();
  // very subtle camera drift
  const scale = interpolate(frame, [0, 300], [1.04, 1.09]);
  const x = Math.sin(frame / 90) * 8;
  const y = Math.cos(frame / 110) * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: "#F6EFE0", overflow: "hidden" }}>
      <Img
        src={staticFile("images/paper-bg.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.55) 0%, rgba(255,250,235,0.15) 45%, rgba(120,100,60,0.16) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
