"use client";

import { motion } from "motion/react";

export type MapPoint = {
  label: string;
  /** Cosine distance from the centre word. 0 = identical meaning. */
  distance: number;
  tone?: "neutral" | "odd";
};

type Props = {
  center: string;
  points: MapPoint[];
  size?: number;
  className?: string;
};

const MAX_SHOWN_DISTANCE = 0.9;

export function MeaningMap({ center, points, size = 520, className }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const inner = 54;
  const outer = size / 2 - 40;

  const radiusFor = (distance: number) =>
    inner + (Math.min(distance, MAX_SHOWN_DISTANCE) / MAX_SHOWN_DISTANCE) * (outer - inner);

  const spread = 300;
  const step = points.length > 1 ? spread / (points.length - 1) : 0;

  const placed = points.map((point, index) => {
    const angle = (-spread / 2 + step * index - 90) * (Math.PI / 180);
    const r = radiusFor(point.distance);
    return {
      ...point,
      x: Number((cx + Math.cos(angle) * r).toFixed(2)),
      y: Number((cy + Math.sin(angle) * r).toFixed(2)),
      r: Number(r.toFixed(2)),
    };
  });

  const odd = placed.find((p) => p.tone === "odd");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`A map of words near "${center}", placed by how similar they are in meaning.`}
    >
      {[0.36, 0.66, 1].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={inner + (outer - inner) * f}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
      ))}

      {odd ? (
        <motion.line
          x1={cx}
          y1={cy}
          x2={odd.x}
          y2={odd.y}
          stroke="var(--color-vermilion)"
          strokeOpacity={0.55}
          strokeDasharray="3 5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, delay: 0.5, ease: "easeInOut" }}
        />
      ) : null}

      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <circle cx={cx} cy={cy} r={6} fill="var(--color-ink)" />
        <circle cx={cx} cy={cy} r={16} fill="none" stroke="var(--color-ink)" strokeOpacity={0.25} />
        <text
          x={cx}
          y={cy + 52}
          textAnchor="middle"
          className="font-serif"
          style={{ fontSize: 30, fill: "var(--color-ink)", fontStyle: "italic" }}
        >
          {center}
        </text>
        <text
          x={cx}
          y={cy + 72}
          textAnchor="middle"
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            fill: "var(--color-ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          THE REAL WORD
        </text>
      </motion.g>

      {placed.map((point, index) => (
        <motion.g
          key={point.label}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.15 + index * 0.08 }}
        >
          <circle
            cx={point.x}
            cy={point.y}
            r={point.tone === "odd" ? 5.5 : 3.5}
            fill={point.tone === "odd" ? "var(--color-vermilion)" : "var(--color-ink)"}
            fillOpacity={point.tone === "odd" ? 1 : 0.55}
          />
          <text
            x={point.x}
            y={point.y - 13}
            textAnchor="middle"
            style={{
              fontSize: point.tone === "odd" ? 17 : 13,
              fill:
                point.tone === "odd" ? "var(--color-vermilion)" : "var(--color-ink)",
              fontFamily: "var(--font-serif)",
              fontStyle: point.tone === "odd" ? "italic" : "normal",
            }}
          >
            {point.label}
          </text>
        </motion.g>
      ))}

      {odd ? (
        <text
          x={odd.x}
          y={odd.y + 30}
          textAnchor="middle"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            fill: "var(--color-vermilion)",
            fontFamily: "var(--font-mono)",
          }}
        >
          THE ODD WORD · {odd.distance.toFixed(2)}
        </text>
      ) : null}

      <text
        x={cx}
        y={size - 10}
        textAnchor="middle"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          fill: "var(--color-ink-soft)",
          fontFamily: "var(--font-mono)",
        }}
      >
        DISTANCE FROM THE REAL WORD
      </text>
    </svg>
  );
}
