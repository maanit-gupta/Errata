import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BrandLens illustration set (DESIGN.md §6). Original flat drawings: 2px ink outlines, flat fills
 * from the `--illo-*` tokens only, so dark mode swaps ink and paper automatically. Decorative:
 * every illustration is aria-hidden. Shapes only, no people or characters.
 */

const INK = "var(--illo-ink)";
const PAPER = "var(--illo-paper)";
const YELLOW = "var(--illo-yellow)";
const PINK = "var(--illo-pink)";
const GREEN = "var(--illo-green)";
const BLUE = "var(--illo-blue)";
const RED = "var(--illo-red)";
const GREY = "var(--illo-grey)";

const line = {
  stroke: INK,
  strokeWidth: 2,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

type IlloProps = { className?: string };

function Svg({
  viewBox,
  className,
  children,
}: {
  viewBox: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      className={cn("block h-auto max-w-full shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/* ---------- building blocks ---------- */

/** A leaf: tip at (x, y), pointing up, rotated by `angle` degrees. */
function Leaf({
  x,
  y,
  size = 40,
  angle = 0,
  fill = GREEN,
}: {
  x: number;
  y: number;
  size?: number;
  angle?: number;
  fill?: string;
}) {
  const s = size;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M0 0 C ${s * 0.45} ${s * 0.25}, ${s * 0.45} ${s * 0.75}, 0 ${s} C ${-s * 0.45} ${s * 0.75}, ${-s * 0.45} ${s * 0.25}, 0 0 Z`}
        fill={fill}
        {...line}
      />
      <path d={`M0 ${s * 0.15} V ${s * 0.95}`} {...line} fill="none" />
    </g>
  );
}

function CheckBadge({ cx, cy, r = 14 }: { cx: number; cy: number; r?: number }) {
  const k = r / 14;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={GREEN} {...line} />
      <path
        d={`M${cx - 6 * k} ${cy} l${4 * k} ${4.5 * k} l${8 * k} ${-9 * k}`}
        fill="none"
        stroke={PAPER}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A small window: rounded frame, title bar with three dots. */
function Window({
  x,
  y,
  w,
  h,
  bar = YELLOW,
  r = 10,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  bar?: string;
  r?: number;
  children?: ReactNode;
}) {
  const barH = Math.max(14, Math.round(h * 0.16));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={PAPER} {...line} />
      <path
        d={`M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + barH} H${x} V${y + r} Q${x} ${y} ${x + r} ${y} Z`}
        fill={bar}
        {...line}
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x + 12 + i * 10} cy={y + barH / 2} r={2.5} fill={INK} />
      ))}
      {children}
    </g>
  );
}

function Bar({
  x,
  y,
  w,
  h = 6,
  fill = GREY,
  outlined = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  outlined?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill={fill}
      {...(outlined ? line : { stroke: "none" })}
    />
  );
}

/* ---------- spot illustrations (empty states, onboarding) ---------- */

export function DocumentSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <path
        d="M30 16 Q30 14 32 14 H74 L90 30 V104 Q90 106 88 106 H32 Q30 106 30 104 Z"
        fill={PAPER}
        {...line}
      />
      <path d="M74 14 V30 H90" fill={GREY} {...line} />
      <Bar x={40} y={40} w={26} />
      <Bar x={38} y={52} w={44} h={10} fill={YELLOW} outlined />
      <Bar x={40} y={70} w={40} />
      <Bar x={40} y={82} w={32} />
      <CheckBadge cx={88} cy={92} r={15} />
    </Svg>
  );
}

export function LensSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <path
        d="M22 18 Q22 16 24 16 H70 Q72 16 72 18 V96 Q72 98 70 98 H24 Q22 98 22 96 Z"
        fill={PAPER}
        {...line}
      />
      <Bar x={30} y={28} w={30} />
      <Bar x={30} y={40} w={34} />
      <Bar x={30} y={52} w={22} />
      <Bar x={30} y={64} w={32} />
      <rect
        x="78"
        y="70"
        width="12"
        height="34"
        rx="5"
        fill={YELLOW}
        transform="rotate(-45 84 87)"
        {...line}
      />
      <circle cx="66" cy="56" r="26" fill={PINK} {...line} />
      <Bar x={52} y={50} w={28} h={10} fill={PAPER} outlined />
      <path d="M52 66 H78" stroke={RED} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <Leaf x={22} y={70} size={34} angle={-35} />
      <Leaf x={98} y={72} size={30} angle={35} fill={YELLOW} />
      <path
        d="M60 14 L94 26 V58 C94 80 80 96 60 106 C40 96 26 80 26 58 V26 Z"
        fill={GREEN}
        {...line}
      />
      <path d="M60 24 L84 33 V58 C84 74 74 86 60 94 Z" fill={PAPER} {...line} />
      <path
        d="M44 58 l10 10 l20 -22"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RuleCardSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <rect x="30" y="22" width="64" height="76" rx="8" fill={PINK} {...line} />
      <rect x="22" y="30" width="64" height="76" rx="8" fill={PAPER} {...line} />
      <rect x="30" y="40" width="30" height="14" rx="4" fill={YELLOW} {...line} />
      <Bar x={30} y={64} w={46} />
      <Bar x={30} y={76} w={38} />
      <Bar x={30} y={88} w={42} />
      <CheckBadge cx={90} cy={30} r={13} />
    </Svg>
  );
}

export function ChartSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <Window x={14} y={18} w={92} h={84} bar={GREY}>
        <rect x="28" y="66" width="12" height="26" rx="2" fill={YELLOW} {...line} />
        <rect x="46" y="50" width="12" height="42" rx="2" fill={PINK} {...line} />
        <rect x="64" y="58" width="12" height="34" rx="2" fill={BLUE} {...line} />
        <rect x="82" y="40" width="12" height="52" rx="2" fill={GREEN} {...line} />
        <path d="M24 92 H98" {...line} />
      </Window>
    </Svg>
  );
}

export function StampSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <rect x="18" y="86" width="84" height="18" rx="4" fill={PAPER} {...line} />
      <Bar x={32} y={92} w={56} h={6} fill={RED} />
      <rect x="34" y="62" width="52" height="18" rx="4" fill={RED} {...line} />
      <path d="M52 62 V44 H68 V62" fill={YELLOW} {...line} />
      <circle cx="60" cy="32" r="14" fill={YELLOW} {...line} />
      <path d="M26 80 H94" {...line} />
    </Svg>
  );
}

export function CalendarSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <rect x="18" y="24" width="84" height="78" rx="8" fill={PAPER} {...line} />
      <path d="M26 24 H94 Q102 24 102 32 V44 H18 V32 Q18 24 26 24 Z" fill={BLUE} {...line} />
      <path d="M40 16 V30 M80 16 V30" {...line} />
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) => (
          <rect
            key={`${c}-${r}`}
            x={28 + c * 18}
            y={54 + r * 20}
            width="12"
            height="12"
            rx="2"
            fill={c === 2 && r === 1 ? PINK : GREY}
            {...(c === 2 && r === 1 ? line : { stroke: "none" })}
          />
        )),
      )}
      <path d="M62 76 l8 8 M70 76 l-8 8" stroke={RED} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function WindowSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <Window x={12} y={20} w={96} h={80}>
        <Bar x={24} y={44} w={56} />
        <Bar x={24} y={56} w={70} h={10} fill={PINK} outlined />
        <Bar x={24} y={74} w={44} />
        <Bar x={24} y={86} w={60} />
      </Window>
    </Svg>
  );
}

export function SpeechSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <path
        d="M20 26 Q20 20 26 20 H90 Q96 20 96 26 V66 Q96 72 90 72 H50 L34 88 V72 H26 Q20 72 20 66 Z"
        fill={YELLOW}
        {...line}
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={44 + i * 14} cy={46} r={4} fill={INK} />
      ))}
      <path
        d="M60 80 Q60 76 64 76 H98 Q102 76 102 80 V98 Q102 102 98 102 H92 V110 L84 102 H64 Q60 102 60 98 Z"
        fill={PINK}
        {...line}
      />
    </Svg>
  );
}

export function LeavesSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <Leaf x={60} y={18} size={64} />
      <Leaf x={36} y={40} size={52} angle={-32} fill={YELLOW} />
      <Leaf x={86} y={44} size={50} angle={34} fill={BLUE} />
      <path d="M44 104 H78" {...line} />
    </Svg>
  );
}

export function BlocksSpot({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 120 120" className={className}>
      <rect x="22" y="70" width="40" height="32" rx="4" fill={BLUE} {...line} />
      <rect x="62" y="70" width="36" height="32" rx="4" fill={PINK} {...line} />
      <rect x="38" y="38" width="44" height="32" rx="4" fill={YELLOW} {...line} />
      <rect x="50" y="16" width="22" height="22" rx="4" fill={GREEN} {...line} />
    </Svg>
  );
}

/** The spot illustrations by name, for EmptyState and onboarding. */
export const SPOTS = {
  document: DocumentSpot,
  lens: LensSpot,
  shield: ShieldSpot,
  "rule-card": RuleCardSpot,
  chart: ChartSpot,
  stamp: StampSpot,
  calendar: CalendarSpot,
  window: WindowSpot,
  speech: SpeechSpot,
  leaves: LeavesSpot,
  blocks: BlocksSpot,
} as const;
export type SpotName = keyof typeof SPOTS;
export const SPOT_NAMES = Object.keys(SPOTS) as SpotName[];

export function Spot({ name, className }: { name: SpotName; className?: string }) {
  const C = SPOTS[name];
  return <C className={className} />;
}

/* ---------- scenes (landing page) ---------- */

/** A draft window being checked by the lens, with cited ID tags. Landing hero. */
export function HeroScene({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 520 440" className={className}>
      <circle cx="300" cy="210" r="170" fill={PINK} />
      <Window x={90} y={60} w={320} h={270} r={16}>
        <Bar x={112} y={124} w={150} h={10} />
        <Bar x={112} y={150} w={250} h={10} />
        <Bar x={112} y={176} w={220} h={10} />
        <rect x="110" y="198" width="190" height="20" rx="4" fill={PINK} {...line} />
        <path d="M112 226 H298" stroke={RED} strokeWidth={3} strokeLinecap="round" />
        <Bar x={112} y={246} w={240} h={10} />
        <Bar x={112} y={272} w={180} h={10} />
        <rect x="112" y="296" width="96" height="22" rx="4" fill={INK} />
      </Window>
      {/* lens */}
      <rect
        x="392"
        y="268"
        width="26"
        height="86"
        rx="10"
        fill={YELLOW}
        transform="rotate(-45 405 311)"
        {...line}
      />
      <circle cx="356" cy="236" r="58" fill={PAPER} {...line} strokeWidth={3} />
      <rect x="318" y="222" width="76" height="26" rx="5" fill={PINK} {...line} />
      <path d="M318 256 H394" stroke={RED} strokeWidth={4} strokeLinecap="round" />
      {/* cited tags */}
      <g>
        <rect x="18" y="168" width="104" height="38" rx="6" fill={PAPER} {...line} />
        <rect x="30" y="181" width="12" height="12" rx="2" fill={RED} {...line} />
        <text
          x="50"
          y="193"
          fontSize="16"
          fontWeight="500"
          fill={INK}
          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
        >
          CL-03
        </text>
      </g>
      <g>
        <rect x="36" y="222" width="90" height="38" rx="6" fill={YELLOW} {...line} />
        <text
          x="52"
          y="247"
          fontSize="16"
          fontWeight="500"
          fill={INK}
          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
        >
          E-19
        </text>
      </g>
      <CheckBadge cx={412} cy={64} r={26} />
      {/* leaves and blocks */}
      <Leaf x={70} y={318} size={86} angle={-28} />
      <Leaf x={112} y={330} size={74} angle={8} fill={YELLOW} />
      <Leaf x={40} y={352} size={60} angle={-58} fill={BLUE} />
      <rect x="430" y="364" width="56" height="44" rx="5" fill={BLUE} {...line} />
      <rect x="452" y="326" width="40" height="38" rx="5" fill={GREEN} {...line} />
      <path d="M20 410 H500" {...line} />
    </Svg>
  );
}

/** Step 1: a guide becomes rule cards. */
export function StepRulesScene({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 240 180" className={className}>
      <path
        d="M24 30 Q24 28 26 28 H80 L96 44 V150 Q96 152 94 152 H26 Q24 152 24 150 Z"
        fill={PAPER}
        {...line}
      />
      <path d="M80 28 V44 H96" fill={GREY} {...line} />
      <Bar x={34} y={58} w={48} />
      <Bar x={34} y={72} w={54} />
      <Bar x={34} y={86} w={40} />
      <Bar x={34} y={100} w={50} />
      <path d="M106 90 H128 M120 82 l8 8 l-8 8" fill="none" {...line} />
      <rect x="150" y="34" width="74" height="40" rx="6" fill={PAPER} {...line} />
      <rect x="158" y="44" width="24" height="10" rx="3" fill={YELLOW} {...line} />
      <Bar x={158} y={60} w={52} h={5} />
      <rect x="142" y="82" width="74" height="40" rx="6" fill={PAPER} {...line} />
      <rect x="150" y="92" width="24" height="10" rx="3" fill={PINK} {...line} />
      <Bar x={150} y={108} w={50} h={5} />
      <rect x="150" y="130" width="74" height="40" rx="6" fill={PAPER} {...line} />
      <rect x="158" y="140" width="24" height="10" rx="3" fill={GREEN} {...line} />
      <Bar x={158} y={156} w={46} h={5} />
    </Svg>
  );
}

/** Step 2: a draft is checked and a line is flagged. */
export function StepCheckScene({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 240 180" className={className}>
      <Window x={22} y={22} w={170} h={136}>
        <Bar x={36} y={58} w={110} />
        <rect x="34" y="74" width="96" height="14" rx="3" fill={PINK} {...line} />
        <path d="M36 94 H128" stroke={RED} strokeWidth={3} strokeLinecap="round" />
        <Bar x={36} y={106} w={120} />
        <Bar x={36} y={122} w={90} />
      </Window>
      <rect
        x="182"
        y="118"
        width="16"
        height="50"
        rx="7"
        fill={YELLOW}
        transform="rotate(-45 190 143)"
        {...line}
      />
      <circle cx="160" cy="98" r="34" fill={PAPER} {...line} strokeWidth={3} />
      <rect x="138" y="88" width="44" height="16" rx="4" fill={PINK} {...line} />
      <path d="M138 110 H182" stroke={RED} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** Step 3: a person reviews and signs off. */
export function StepApproveScene({ className }: IlloProps) {
  return (
    <Svg viewBox="0 0 240 180" className={className}>
      <rect x="28" y="24" width="120" height="136" rx="10" fill={PAPER} {...line} />
      <Bar x={42} y={42} w={70} />
      <Bar x={42} y={56} w={90} />
      <Bar x={42} y={70} w={80} />
      <rect x="40" y="96" width="96" height="44" rx="6" fill={GREY} {...line} />
      <path
        d="M56 118 l10 10 l22 -22"
        fill="none"
        stroke={GREEN}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="150" y="120" width="70" height="18" rx="4" fill={RED} {...line} />
      <path d="M170 120 V100 H200 V120" fill={YELLOW} {...line} />
      <circle cx="185" cy="88" r="14" fill={YELLOW} {...line} />
      <CheckBadge cx={200} cy={40} r={18} />
    </Svg>
  );
}
