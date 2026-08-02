"use client";

import { toPersianDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { GaugeBand } from "@/lib/age-balance/gauge-bands";

/**
 * An original semicircular gauge for the Herd Age Balance module — not a
 * copy of any third-party "Fear & Greed"-style widget, just plain SVG arc
 * math (no new charting dependency). A gauge is generic: which bands/
 * colors it's given determines whether it reads as "direction" (Youth
 * Index — higher is not "better") or "quality" (Age Balance — higher is
 * better); this component itself has no opinion either way — that logic
 * lives in src/lib/age-balance/gauge-bands.ts, not here.
 */

interface AgeGaugeProps {
  value: number;
  bands: GaugeBand[];
  size?: number;
}

const CENTER_X = 100;
const CENTER_Y = 96;
const RADIUS = 84;
const TRACK_WIDTH = 16;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function angleForValue(value: number): number {
  return -90 + (Math.max(0, Math.min(100, value)) / 100) * 180;
}

export function AgeGauge({ value, bands, size = 220 }: AgeGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const needleAngle = angleForValue(clamped);
  const needleTip = polarToCartesian(CENTER_X, CENTER_Y, RADIUS - TRACK_WIDTH / 2 - 6, needleAngle);
  const currentBand = bands.find((b) => clamped <= b.max) ?? bands[bands.length - 1];

  let segmentStart = 0;
  return (
    <div className="flex flex-col items-center gap-1" dir="ltr">
      <svg viewBox="0 0 200 120" width={size} height={(size * 120) / 200} role="img" aria-label={`${Math.round(clamped)} از ۱۰۰ — ${currentBand.label}`}>
        {bands.map((band) => {
          const startAngle = angleForValue(segmentStart);
          const endAngle = angleForValue(band.max);
          segmentStart = band.max;
          return (
            <path
              key={band.max}
              d={describeArc(CENTER_X, CENTER_Y, RADIUS, startAngle, endAngle)}
              fill="none"
              stroke={band.color}
              strokeWidth={TRACK_WIDTH}
              strokeLinecap="butt"
            />
          );
        })}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          className="text-foreground transition-[x2,y2] duration-700 ease-out"
        />
        <circle cx={CENTER_X} cy={CENTER_Y} r={6} fill="currentColor" className="text-foreground" />
      </svg>
      <div dir="rtl" className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-2xl font-bold">
          {toPersianDigits(Math.round(clamped))} <span className="text-sm font-normal text-muted-foreground">/ ۱۰۰</span>
        </span>
        <span className={cn("text-sm font-semibold")} style={{ color: currentBand.color }}>
          {currentBand.label}
        </span>
      </div>
    </div>
  );
}
