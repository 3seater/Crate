/**
 * Custom overlay extensions ported from klinecharts/pro (Apache 2.0).
 * Registers all drawing tools that are NOT built into klinecharts core:
 * arrow, circle, rect, triangle, parallelogram, fibonacciSegment,
 * fibonacciCircle, fibonacciSpiral, fibonacciSpeedResistanceFan,
 * fibonacciExtension, gannBox, xabcd, abcd, threeWaves, fiveWaves,
 * eightWaves, anyWaves.
 *
 * Call `registerProOverlays()` once before creating any chart instance.
 *
 * @see https://github.com/klinecharts/pro/tree/main/src/extension
 * @license Apache-2.0
 */

import type {
  Bounding,
  Coordinate,
  LineAttrs,
  OverlayTemplate,
} from "klinecharts";
import { registerOverlay, utils } from "klinecharts";

// ─── Geometry utils (from klinecharts/pro extension/utils.ts) ─────────────

function getRotateCoordinate(
  coordinate: Coordinate,
  target: Coordinate,
  angle: number
): Coordinate {
  const x =
    (coordinate.x - target.x) * Math.cos(angle) -
    (coordinate.y - target.y) * Math.sin(angle) +
    target.x;
  const y =
    (coordinate.x - target.x) * Math.sin(angle) +
    (coordinate.y - target.y) * Math.cos(angle) +
    target.y;
  return { x, y };
}

function getDistance(a: Coordinate, b: Coordinate): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function getRayLine(
  coordinates: Coordinate[],
  bounding: Bounding
): LineAttrs | LineAttrs[] {
  if (coordinates.length > 1) {
    let coordinate: Coordinate;
    if (
      coordinates[0].x === coordinates[1].x &&
      coordinates[0].y !== coordinates[1].y
    ) {
      coordinate =
        coordinates[0].y < coordinates[1].y
          ? { x: coordinates[0].x, y: bounding.height }
          : { x: coordinates[0].x, y: 0 };
    } else if (coordinates[0].x > coordinates[1].x) {
      coordinate = {
        x: 0,
        y: utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], {
          x: 0,
          y: coordinates[0].y,
        }),
      };
    } else {
      coordinate = {
        x: bounding.width,
        y: utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], {
          x: bounding.width,
          y: coordinates[0].y,
        }),
      };
    }
    return { coordinates: [coordinates[0], coordinate] };
  }
  return [];
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

const arrow: OverlayTemplate = {
  name: "arrow",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const flag = coordinates[1].x > coordinates[0].x ? 0 : 1;
      const kb = utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
      let offsetAngle: number;
      if (kb) {
        offsetAngle = Math.atan(kb[0]) + Math.PI * flag;
      } else {
        offsetAngle =
          coordinates[1].y > coordinates[0].y ? Math.PI / 2 : (Math.PI / 2) * 3;
      }
      const r1 = getRotateCoordinate(
        { x: coordinates[1].x - 8, y: coordinates[1].y + 4 },
        coordinates[1],
        offsetAngle
      );
      const r2 = getRotateCoordinate(
        { x: coordinates[1].x - 8, y: coordinates[1].y - 4 },
        coordinates[1],
        offsetAngle
      );
      return [
        { type: "line", attrs: { coordinates } },
        {
          type: "line",
          ignoreEvent: true,
          attrs: { coordinates: [r1, coordinates[1], r2] },
        },
      ];
    }
    return [];
  },
};

// ─── Shapes ───────────────────────────────────────────────────────────────────

const circle: OverlayTemplate = {
  name: "circle",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { circle: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const radius = getDistance(coordinates[0], coordinates[1]);
      return {
        type: "circle",
        attrs: { ...coordinates[0], r: radius },
        styles: { style: "stroke_fill" },
      };
    }
    return [];
  },
};

const rect: OverlayTemplate = {
  name: "rect",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      return [
        {
          type: "polygon",
          attrs: {
            coordinates: [
              coordinates[0],
              { x: coordinates[1].x, y: coordinates[0].y },
              coordinates[1],
              { x: coordinates[0].x, y: coordinates[1].y },
            ],
          },
          styles: { style: "stroke_fill" },
        },
      ];
    }
    return [];
  },
};

const triangle: OverlayTemplate = {
  name: "triangle",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => [
    {
      type: "polygon",
      attrs: { coordinates },
      styles: { style: "stroke_fill" },
    },
  ],
};

const parallelogram: OverlayTemplate = {
  name: "parallelogram",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [{ type: "line", ignoreEvent: true, attrs: { coordinates } }];
    }
    if (coordinates.length === 3) {
      const c = {
        x: coordinates[0].x + (coordinates[2].x - coordinates[1].x),
        y: coordinates[2].y,
      };
      return [
        {
          type: "polygon",
          attrs: {
            coordinates: [coordinates[0], coordinates[1], coordinates[2], c],
          },
          styles: { style: "stroke_fill" },
        },
      ];
    }
    return [];
  },
  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    if (performPointIndex < 2) {
      // @ts-expect-error — klinecharts-pro pattern: sync price across points
      points[0].price = performPoint.price;
      // @ts-expect-error — klinecharts-pro pattern: sync price across points
      points[1].price = performPoint.price;
    }
  },
  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      // @ts-expect-error — klinecharts-pro pattern: sync price across points
      points[0].price = performPoint.price;
    }
  },
};

// ─── Fibonacci extensions ─────────────────────────────────────────────────────

const fibonacciSegment: OverlayTemplate = {
  name: "fibonacciSegment",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, chart }) => {
    const lines: LineAttrs[] = [];
    const texts: Array<{
      x: number;
      y: number;
      text: string;
      baseline: string;
    }> = [];
    if (coordinates.length > 1) {
      const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2;
      const textX =
        coordinates[1].x > coordinates[0].x
          ? coordinates[0].x
          : coordinates[1].x;
      const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
      const yDif = coordinates[0].y - coordinates[1].y;
      const points = overlay.points;
      const valueDif =
        ((points[0] as { value?: number })?.value ?? 0) -
        ((points[1] as { value?: number })?.value ?? 0);
      for (const percent of percents) {
        const y = coordinates[1].y + yDif * percent;
        const price = (
          ((points[1] as { value?: number })?.value ?? 0) +
          valueDif * percent
        ).toFixed(pricePrecision);
        lines.push({
          coordinates: [
            { x: coordinates[0].x, y },
            { x: coordinates[1].x, y },
          ],
        });
        texts.push({
          x: textX,
          y,
          text: `${price} (${(percent * 100).toFixed(1)}%)`,
          baseline: "bottom",
        });
      }
    }
    return [
      { type: "line", attrs: lines },
      { type: "text", ignoreEvent: true, attrs: texts },
    ];
  },
};

const fibonacciCircle: OverlayTemplate = {
  name: "fibonacciCircle",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const radius = getDistance(coordinates[0], coordinates[1]);
      const percents = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const circles: Array<{ x: number; y: number; r: number }> = [];
      const texts: Array<{ x: number; y: number; text: string }> = [];
      for (const percent of percents) {
        const r = radius * percent;
        circles.push({ ...coordinates[0], r });
        texts.push({
          x: coordinates[0].x,
          y: coordinates[0].y + r + 6,
          text: `${(percent * 100).toFixed(1)}%`,
        });
      }
      return [
        { type: "circle", attrs: circles, styles: { style: "stroke" } },
        { type: "text", ignoreEvent: true, attrs: texts },
      ];
    }
    return [];
  },
};

const fibonacciSpiral: OverlayTemplate = {
  name: "fibonacciSpiral",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length > 1) {
      const startRadius =
        getDistance(coordinates[0], coordinates[1]) / Math.sqrt(24);
      const flag = coordinates[1].x > coordinates[0].x ? 0 : 1;
      const kb = utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
      let offsetAngle: number;
      if (kb) {
        offsetAngle = Math.atan(kb[0]) + Math.PI * flag;
      } else {
        offsetAngle =
          coordinates[1].y > coordinates[0].y ? Math.PI / 2 : (Math.PI / 2) * 3;
      }
      const rc1 = getRotateCoordinate(
        { x: coordinates[0].x - startRadius, y: coordinates[0].y },
        coordinates[0],
        offsetAngle
      );
      const rc2 = getRotateCoordinate(
        {
          x: coordinates[0].x - startRadius,
          y: coordinates[0].y - startRadius,
        },
        coordinates[0],
        offsetAngle
      );
      const arcs: Array<{
        x: number;
        y: number;
        r: number;
        startAngle: number;
        endAngle: number;
      }> = [
        {
          ...rc1,
          r: startRadius,
          startAngle: offsetAngle,
          endAngle: offsetAngle + Math.PI / 2,
        },
        {
          ...rc2,
          r: startRadius * 2,
          startAngle: offsetAngle + Math.PI / 2,
          endAngle: offsetAngle + Math.PI,
        },
      ];
      let x = coordinates[0].x - startRadius;
      let y = coordinates[0].y - startRadius;
      for (let i = 2; i < 9; i++) {
        const r = arcs[i - 2].r + arcs[i - 1].r;
        let startAngle = 0;
        switch (i % 4) {
          case 0:
            startAngle = offsetAngle;
            x -= arcs[i - 2].r;
            break;
          case 1:
            startAngle = offsetAngle + Math.PI / 2;
            y -= arcs[i - 2].r;
            break;
          case 2:
            startAngle = offsetAngle + Math.PI;
            x += arcs[i - 2].r;
            break;
          case 3:
            startAngle = offsetAngle + (Math.PI / 2) * 3;
            y += arcs[i - 2].r;
            break;
          default:
            break;
        }
        const endAngle = startAngle + Math.PI / 2;
        const rc = getRotateCoordinate({ x, y }, coordinates[0], offsetAngle);
        arcs.push({ ...rc, r, startAngle, endAngle });
      }
      return [
        { type: "arc", attrs: arcs },
        { type: "line", attrs: getRayLine(coordinates, bounding) },
      ];
    }
    return [];
  },
};

function appendRayLine(
  target: LineAttrs[],
  coords: Coordinate[],
  bounding: Bounding
): void {
  const result = getRayLine(coords, bounding);
  if (Array.isArray(result)) {
    for (const r of result) {
      target.push(r);
    }
  } else if ("coordinates" in result) {
    target.push(result as LineAttrs);
  }
}

function buildFanFigures(coordinates: Coordinate[], bounding: Bounding) {
  const lines1: LineAttrs[] = [];
  const lines2: LineAttrs[] = [];
  const texts: Array<{ x: number; y: number; text: string }> = [];
  const xOffset = coordinates[1].x > coordinates[0].x ? -38 : 4;
  const yOffset = coordinates[1].y > coordinates[0].y ? -2 : 20;
  const xDist = coordinates[1].x - coordinates[0].x;
  const yDist = coordinates[1].y - coordinates[0].y;
  const percents = [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0];
  for (const percent of percents) {
    const px = coordinates[1].x - xDist * percent;
    const py = coordinates[1].y - yDist * percent;
    lines1.push({
      coordinates: [
        { x: px, y: coordinates[0].y },
        { x: px, y: coordinates[1].y },
      ],
    });
    lines1.push({
      coordinates: [
        { x: coordinates[0].x, y: py },
        { x: coordinates[1].x, y: py },
      ],
    });
    appendRayLine(
      lines2,
      [coordinates[0], { x: px, y: coordinates[1].y }],
      bounding
    );
    appendRayLine(
      lines2,
      [coordinates[0], { x: coordinates[1].x, y: py }],
      bounding
    );
    texts.unshift({
      x: coordinates[0].x + xOffset,
      y: py + 10,
      text: `${percent.toFixed(3)}`,
    });
    texts.unshift({
      x: px - 18,
      y: coordinates[0].y + yOffset,
      text: `${percent.toFixed(3)}`,
    });
  }
  return [
    { type: "line" as const, attrs: lines1 },
    { type: "line" as const, attrs: lines2 },
    { type: "text" as const, ignoreEvent: true, attrs: texts },
  ];
}

const fibonacciSpeedResistanceFan: OverlayTemplate = {
  name: "fibonacciSpeedResistanceFan",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length <= 1) {
      return [];
    }
    return buildFanFigures(coordinates, bounding);
  },
};

const fibonacciExtension: OverlayTemplate = {
  name: "fibonacciExtension",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, chart }) => {
    const fbLines: LineAttrs[] = [];
    const texts: Array<{
      x: number;
      y: number;
      text: string;
      baseline: string;
    }> = [];
    if (coordinates.length > 2) {
      const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2;
      const points = overlay.points;
      const valueDif =
        ((points[1] as { value?: number })?.value ?? 0) -
        ((points[0] as { value?: number })?.value ?? 0);
      const yDif = coordinates[1].y - coordinates[0].y;
      const percents = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const textX =
        coordinates[2].x > coordinates[1].x
          ? coordinates[1].x
          : coordinates[2].x;
      for (const percent of percents) {
        const y = coordinates[2].y + yDif * percent;
        const price = (
          ((points[2] as { value?: number })?.value ?? 0) +
          valueDif * percent
        ).toFixed(pricePrecision);
        fbLines.push({
          coordinates: [
            { x: coordinates[1].x, y },
            { x: coordinates[2].x, y },
          ],
        });
        texts.push({
          x: textX,
          y,
          text: `${price} (${(percent * 100).toFixed(1)}%)`,
          baseline: "bottom",
        });
      }
    }
    return [
      {
        type: "line",
        attrs: { coordinates },
        styles: { style: "dashed" },
      },
      { type: "line", attrs: fbLines },
      { type: "text", ignoreEvent: true, attrs: texts },
    ];
  },
};

// ─── Gann Box ─────────────────────────────────────────────────────────────────

const gannBox: OverlayTemplate = {
  name: "gannBox",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const qy = (coordinates[1].y - coordinates[0].y) / 4;
      const xDis = coordinates[1].x - coordinates[0].x;
      const dashedLines: LineAttrs[] = [
        {
          coordinates: [
            coordinates[0],
            { x: coordinates[1].x, y: coordinates[1].y - qy },
          ],
        },
        {
          coordinates: [
            coordinates[0],
            { x: coordinates[1].x, y: coordinates[1].y - qy * 2 },
          ],
        },
        {
          coordinates: [
            { x: coordinates[0].x, y: coordinates[1].y },
            { x: coordinates[1].x, y: coordinates[0].y + qy },
          ],
        },
        {
          coordinates: [
            { x: coordinates[0].x, y: coordinates[1].y },
            { x: coordinates[1].x, y: coordinates[0].y + qy * 2 },
          ],
        },
        {
          coordinates: [
            { ...coordinates[0] },
            { x: coordinates[0].x + xDis * 0.236, y: coordinates[1].y },
          ],
        },
        {
          coordinates: [
            { ...coordinates[0] },
            { x: coordinates[0].x + xDis * 0.5, y: coordinates[1].y },
          ],
        },
        {
          coordinates: [
            { x: coordinates[0].x, y: coordinates[1].y },
            { x: coordinates[0].x + xDis * 0.236, y: coordinates[0].y },
          ],
        },
        {
          coordinates: [
            { x: coordinates[0].x, y: coordinates[1].y },
            { x: coordinates[0].x + xDis * 0.5, y: coordinates[0].y },
          ],
        },
      ];
      const solidLines: LineAttrs[] = [
        { coordinates: [coordinates[0], coordinates[1]] },
        {
          coordinates: [
            { x: coordinates[0].x, y: coordinates[1].y },
            { x: coordinates[1].x, y: coordinates[0].y },
          ],
        },
      ];
      return [
        {
          type: "line",
          attrs: [
            {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
              ],
            },
            {
              coordinates: [
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
              ],
            },
            {
              coordinates: [
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y },
              ],
            },
            {
              coordinates: [
                { x: coordinates[0].x, y: coordinates[1].y },
                coordinates[0],
              ],
            },
          ],
        },
        {
          type: "polygon",
          ignoreEvent: true,
          attrs: {
            coordinates: [
              coordinates[0],
              { x: coordinates[1].x, y: coordinates[0].y },
              coordinates[1],
              { x: coordinates[0].x, y: coordinates[1].y },
            ],
          },
          styles: { style: "fill" },
        },
        { type: "line", attrs: dashedLines, styles: { style: "dashed" } },
        { type: "line", attrs: solidLines },
      ];
    }
    return [];
  },
};

// ─── Wave patterns ────────────────────────────────────────────────────────────

function createWaveOverlay(name: string, totalStep: number): OverlayTemplate {
  return {
    name,
    totalStep,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      const texts = coordinates.map((c, i) => ({
        ...c,
        text: `(${i})`,
        baseline: "bottom" as const,
      }));
      return [
        { type: "line", attrs: { coordinates } },
        { type: "text", ignoreEvent: true, attrs: texts },
      ];
    },
  };
}

const threeWaves = createWaveOverlay("threeWaves", 5);
const fiveWaves = createWaveOverlay("fiveWaves", 7);
const eightWaves = createWaveOverlay("eightWaves", 10);
const anyWaves = createWaveOverlay("anyWaves", Number.MAX_SAFE_INTEGER);

// ─── Harmonic patterns ────────────────────────────────────────────────────────

const xabcd: OverlayTemplate = {
  name: "xabcd",
  totalStep: 6,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    const dashedLines: LineAttrs[] = [];
    const polygons: Array<{ coordinates: Coordinate[] }> = [];
    const tags = ["X", "A", "B", "C", "D"];
    const texts = coordinates.map((c, i) => ({
      ...c,
      baseline: "bottom" as const,
      text: `(${tags[i]})`,
    }));
    if (coordinates.length > 2) {
      dashedLines.push({
        coordinates: [coordinates[0], coordinates[2]],
      });
      polygons.push({
        coordinates: [coordinates[0], coordinates[1], coordinates[2]],
      });
      if (coordinates.length > 3) {
        dashedLines.push({
          coordinates: [coordinates[1], coordinates[3]],
        });
        if (coordinates.length > 4) {
          dashedLines.push({
            coordinates: [coordinates[2], coordinates[4]],
          });
          polygons.push({
            coordinates: [coordinates[2], coordinates[3], coordinates[4]],
          });
        }
      }
    }
    return [
      { type: "line", attrs: { coordinates } },
      {
        type: "line",
        attrs: dashedLines,
        styles: { style: "dashed" },
      },
      { type: "polygon", ignoreEvent: true, attrs: polygons },
      { type: "text", ignoreEvent: true, attrs: texts },
    ];
  },
};

const abcd: OverlayTemplate = {
  name: "abcd",
  totalStep: 5,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    let acLine: Coordinate[] = [];
    let bdLine: Coordinate[] = [];
    const tags = ["A", "B", "C", "D"];
    const texts = coordinates.map((c, i) => ({
      ...c,
      baseline: "bottom" as const,
      text: `(${tags[i]})`,
    }));
    if (coordinates.length > 2) {
      acLine = [coordinates[0], coordinates[2]];
      if (coordinates.length > 3) {
        bdLine = [coordinates[1], coordinates[3]];
      }
    }
    return [
      { type: "line", attrs: { coordinates } },
      {
        type: "line",
        attrs: [{ coordinates: acLine }, { coordinates: bdLine }],
        styles: { style: "dashed" },
      },
      { type: "text", ignoreEvent: true, attrs: texts },
    ];
  },
};

// ─── Registration ─────────────────────────────────────────────────────────────

const PRO_OVERLAYS: OverlayTemplate[] = [
  arrow,
  circle,
  rect,
  triangle,
  parallelogram,
  fibonacciSegment,
  fibonacciCircle,
  fibonacciSpiral,
  fibonacciSpeedResistanceFan,
  fibonacciExtension,
  gannBox,
  threeWaves,
  fiveWaves,
  eightWaves,
  anyWaves,
  xabcd,
  abcd,
];

let registered = false;

/** Register all klinecharts-pro overlay extensions. Safe to call multiple times. */
export function registerProOverlays(): void {
  if (registered) {
    return;
  }
  registered = true;
  for (const overlay of PRO_OVERLAYS) {
    registerOverlay(overlay);
  }
}
