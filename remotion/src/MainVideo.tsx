import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Cairo";
import { PaperBackground } from "./components/PaperBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["arabic", "latin"],
});

const GOLD = "#E4BE63";
const GOLD_DEEP = "#B98B2C";

const TRANSITION_START = 150;

// logo natural ratio 996 x 1179
const LOGO_W = 520;
const LOGO_H = (LOGO_W * 1179) / 996;

const BOARD_W = 1190;
const BOARD_H = (BOARD_W * 1024) / 1536;
const BOARD_CY = 592;

// soft radial fragments that drift together to form the logo
const PIECES = 10;
const PIECE_ANGLE = 360 / PIECES;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${cx + r * Math.cos(rad)}% ${cy + r * Math.sin(rad)}%`;
};
const wedge = (i: number) => {
  const a0 = i * PIECE_ANGLE;
  const pts = [`50% 50%`];
  for (let s = 0; s <= 4; s++) {
    pts.push(polar(50, 50, 120, a0 + (PIECE_ANGLE * s) / 4));
  }
  return `polygon(${pts.join(",")})`;
};


export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- transition (logo shrink + board rise) ----
  const t = spring({
    frame: frame - TRANSITION_START,
    fps,
    config: { damping: 14, stiffness: 110, mass: 1 },
  });

  const logoScale = interpolate(t, [0, 1], [1, 0.235]);
  const logoY = interpolate(t, [0, 1], [468, 152]);

  const boardT = spring({
    frame: frame - TRANSITION_START - 4,
    fps,
    config: { damping: 14, stiffness: 110, mass: 1 },
  });
  const boardY = interpolate(boardT, [0, 1], [BOARD_CY + 900, BOARD_CY]);
  const boardTilt = interpolate(boardT, [0, 1], [3.5, 0]);




  // rays behind logo
  const raysPulse = 1 + Math.sin(frame / 14) * 0.035;
  const raysOpacity =
    interpolate(frame, [8, 40], [0, 0.55], { extrapolateRight: "clamp" }) *
    (1 - t * 0.75) *
    (0.85 + Math.sin(frame / 12) * 0.15);
  const raysRot = frame * 0.12;

  // gentle drift for the whole stage
  const driftX = Math.sin(frame / 100) * 6;
  const driftY = Math.cos(frame / 130) * 5;

  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: "#F6EFE0" }}>
      <PaperBackground />

      <AbsoluteFill style={{ transform: `translate(${driftX}px, ${driftY}px)` }}>
        {/* gold paper rays */}
        <Img
          src={staticFile("images/rays.png")}
          style={{
            position: "absolute",
            width: 1350,
            height: 1350,
            left: 960 - 675,
            top: 468 - 675,
            opacity: raysOpacity,
            transform: `scale(${raysPulse}) rotate(${raysRot}deg)`,
          }}
        />

        {/* green board */}
        <div
          style={{
            position: "absolute",
            width: BOARD_W,
            height: BOARD_H,
            left: 960 - BOARD_W / 2,
            top: boardY - BOARD_H / 2,
            transform: `rotate(${boardTilt}deg)`,
            filter: "drop-shadow(0 26px 38px rgba(70,55,25,0.32))",
          }}
        >
          <Img
            src={staticFile("images/board.png")}
            style={{ width: "100%", height: "100%" }}
          />

        </div>

        {/* logo pieces */}
        <div
          style={{
            position: "absolute",
            width: LOGO_W,
            height: LOGO_H,
            left: 960 - LOGO_W / 2,
            top: logoY - LOGO_H / 2,
            transform: `scale(${logoScale})`,
            transformOrigin: "center center",
            filter: "drop-shadow(0 14px 20px rgba(80,64,30,0.3))",
          }}
        >
          {Array.from({ length: PIECES }).map((_, i) => {
            // stagger clockwise but with irregular, organic delays
            const delay = 6 + i * 3.4 + Math.sin(i * 2.1) * 2.2;
            const s = spring({
              frame: frame - delay,
              fps,
              config: { damping: 200, stiffness: 26, mass: 1.1 },
            });
            const angle = i * PIECE_ANGLE - 90;
            const rad = (angle * Math.PI) / 180;
            const dist = 210 + (i % 3) * 42;
            const px = interpolate(s, [0, 1], [Math.cos(rad) * dist, 0]);
            const py = interpolate(s, [0, 1], [Math.sin(rad) * dist, 0]);
            const rot = interpolate(s, [0, 1], [i % 2 === 0 ? -9 : 9, 0]);
            const sc = interpolate(s, [0, 1], [1.14, 1]);
            const blur = interpolate(s, [0, 0.85], [18, 0], {
              extrapolateRight: "clamp",
            });
            // soft continuous breathing after settling
            const wave = Math.sin((frame - i * 5) / 34) * 2.4 * (1 - t) * s;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: wedge(i),
                  transform: `translate(${px}px, ${py + wave}px) rotate(${rot}deg) scale(${sc})`,
                  transformOrigin: "center center",
                  filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
                  opacity: interpolate(s, [0, 0.45], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <Img
                  src={staticFile("images/logo.png")}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            );
          })}

          {/* gold shine sweep across the finished logo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: interpolate(frame, [70, 84, 108, 122], [0, 0.5, 0.5, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              background: `linear-gradient(105deg, transparent ${interpolate(
                frame,
                [70, 122],
                [-40, 90],
              )}%, ${GOLD}66 ${interpolate(frame, [70, 122], [-20, 110])}%, transparent ${interpolate(
                frame,
                [70, 122],
                [5, 135],
              )}%)`,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
