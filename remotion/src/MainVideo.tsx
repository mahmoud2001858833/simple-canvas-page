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

const PIECES = [
  { x: 0, y: 0, w: 34, h: 40, from: [-520, -260], rot: -22 },
  { x: 34, y: 0, w: 32, h: 40, from: [0, -520], rot: 14 },
  { x: 66, y: 0, w: 34, h: 40, from: [520, -240], rot: 20 },
  { x: 0, y: 40, w: 34, h: 32, from: [-560, 60], rot: 16 },
  { x: 34, y: 40, w: 32, h: 32, from: [0, 300], rot: -10 },
  { x: 66, y: 40, w: 34, h: 32, from: [560, 40], rot: -18 },
  { x: 0, y: 72, w: 34, h: 28, from: [-420, 420], rot: 24 },
  { x: 34, y: 72, w: 32, h: 28, from: [40, 560], rot: -12 },
  { x: 66, y: 72, w: 34, h: 28, from: [440, 400], rot: -24 },
];

export const MainVideo: React.FC<{
  courseTitle: string;
  teacherName: string;
}> = ({ courseTitle, teacherName }) => {
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

  const textSpring = (delay: number) =>
    spring({
      frame: frame - TRANSITION_START - delay,
      fps,
      config: { damping: 14, stiffness: 110, mass: 1 },
    });

  const titleT = textSpring(10);
  const dividerT = textSpring(13);
  const nameT = textSpring(16);

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
          {PIECES.map((p, i) => {
            const s = spring({
              frame: frame - 6 - i * 8,
              fps,
              config: { damping: 18, stiffness: 70, mass: 1.1 },
            });
            const px = interpolate(s, [0, 1], [p.from[0], 0]);
            const py = interpolate(s, [0, 1], [p.from[1], 0]);
            const rot = interpolate(s, [0, 1], [p.rot, 0]);
            const settleWobble =
              (1 - s) * 0 + Math.sin((frame - i * 7) / 26) * 1.4 * (1 - t);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: `inset(${p.y}% ${100 - (p.x + p.w)}% ${100 - (p.y + p.h)}% ${p.x}%)`,
                  transform: `translate(${px}px, ${py + settleWobble}px) rotate(${rot}deg)`,
                  opacity: interpolate(s, [0, 0.25], [0, 1], {
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
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
