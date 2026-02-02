/**
 * Static SVG/PNG Generation Script
 * Generates nightly static images from data
 * 
 * Usage: node scripts/generate-static.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read input data
const inputPath = path.join(__dirname, '..', 'input.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Import geometry utilities (we'll inline the necessary functions for Node.js)
const VIEWBOX_SIZE = 1024;
const CENTER = VIEWBOX_SIZE / 2;
const R_OUTER = 420;
const W_RING = 64;
const R_BLUE = 330;
const TICK_LENGTH = 14;
const BARRIER_TICK_LENGTH = 20;
const CENTER_DOT_R = 48;
const DAYS_IN_10_YEARS = 10 * 365;
const ANGLE_PER_DAY = 360 / DAYS_IN_10_YEARS;

function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z');
}

function daysBetween(startDate, endDate) {
  const start = typeof startDate === 'string' ? parseDate(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDate(endDate) : endDate;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function calculateRotationAngle(startDate, currentDate) {
  return daysBetween(startDate, currentDate) * ANGLE_PER_DAY;
}

function calculatePerformance(initialLevel, currentLevel) {
  return ((currentLevel - initialLevel) / initialLevel) * 100;
}

function easeOutQuad(t) {
  return t * (2 - t);
}

function mapPerformanceToAngle(performancePercent) {
  const clamped = Math.max(-50, Math.min(50, performancePercent));
  const anchors = [
    [-50, -120], [-30, -90], [-5, -30], [0, 0],
    [5, 30], [30, 90], [50, 120]
  ];
  
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p1, a1] = anchors[i];
    const [p2, a2] = anchors[i + 1];
    if (clamped >= p1 && clamped <= p2) {
      const t = (clamped - p1) / (p2 - p1);
      return a1 + easeOutQuad(t) * (a2 - a1);
    }
  }
  return 0;
}

function mapBarrierToAngle(barrierPercent) {
  const absBarrier = Math.abs(barrierPercent);
  return -(90 + (absBarrier - 30) * 1.5);
}

function angleToCoords(angleDeg, radius, cx = CENTER, cy = CENTER) {
  const adjustedAngle = angleDeg - 90;
  const radians = (adjustedAngle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function generateSegmentPath(segmentIndex, totalSegments, innerRadius, outerRadius, gapAngle = 3) {
  const segmentAngle = 360 / totalSegments;
  const startAngle = segmentIndex * segmentAngle + gapAngle / 2;
  const endAngle = (segmentIndex + 1) * segmentAngle - gapAngle / 2;
  
  const innerStart = angleToCoords(startAngle, innerRadius);
  const innerEnd = angleToCoords(endAngle, innerRadius);
  const outerStart = angleToCoords(startAngle, outerRadius);
  const outerEnd = angleToCoords(endAngle, outerRadius);
  
  const largeArc = segmentAngle - gapAngle > 180 ? 1 : 0;
  
  return `M ${innerStart.x} ${innerStart.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y} L ${outerEnd.x} ${outerEnd.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerStart.x} ${outerStart.y} Z`;
}

/**
 * Generate static SVG string
 */
function generateStaticSVG(data) {
  const {
    plan_name, tenor_years, start_date, current_date,
    initial_strike_level, current_level, barrier_percent,
    observations, final_hurdle_percent,
    counterparty, is_called, called_date, brand_colours, design_tokens
  } = data;

  const colors = {
    navy: brand_colours?.navy || '#0A255A',
    greenPrimary: brand_colours?.green_primary || '#007A3A',
    greenAccent: brand_colours?.green_accent || '#0FA15A',
    barrierRed: brand_colours?.barrier_red || '#C62828',
    finalPurple: brand_colours?.final_hurdle_purple || '#5E35B1',
    greyLight: brand_colours?.grey_light || '#D9D9D9',
    greyMid: brand_colours?.grey_mid || '#A6A6A6'
  };

  const tokens = {
    gapAngle: design_tokens?.gap_angle_deg || 3,
    tickStroke: design_tokens?.tick_stroke_width || 2,
    segmentOutline: design_tokens?.segment_outline_width || 2
  };

  const rotationAngle = calculateRotationAngle(start_date, current_date);
  const performance = calculatePerformance(initial_strike_level, current_level);
  const pointerAngle = mapPerformanceToAngle(performance);
  const barrierAngle = mapBarrierToAngle(barrier_percent);
  const finalHurdleAngle = mapPerformanceToAngle(final_hurdle_percent - 100);

  const centreColor = colors.greenPrimary;

  // Generate outer ring segments
  const innerR = R_OUTER - W_RING;
  const outerR = R_OUTER;
  let segments = '';
  for (let i = 0; i < tenor_years; i++) {
    const elapsedAngle = daysBetween(start_date, current_date) * ANGLE_PER_DAY;
    const isElapsed = elapsedAngle > (i + 1) * 36;
    const fillColor = isElapsed ? colors.greyMid : colors.navy;
    const opacity = isElapsed ? 0.5 : 1;
    segments += `<path d="${generateSegmentPath(i, 10, innerR, outerR, tokens.gapAngle)}" fill="${fillColor}" stroke="${colors.navy}" stroke-width="${tokens.segmentOutline}" opacity="${opacity}"/>`;
  }

  // Generate observation ticks
  let ticks = '';
  observations.forEach((obs, index) => {
    const daysToObs = daysBetween(start_date, obs.date);
    const tickAngle = -(daysToObs * ANGLE_PER_DAY) + rotationAngle;
    const innerPoint = angleToCoords(tickAngle, R_BLUE - TICK_LENGTH);
    const outerPoint = angleToCoords(tickAngle, R_BLUE + TICK_LENGTH);
    const strokeWidth = obs.triggered ? 4 : tokens.tickStroke;
    const strokeColor = obs.triggered ? colors.greenAccent : colors.navy;
    ticks += `<line x1="${innerPoint.x}" y1="${innerPoint.y}" x2="${outerPoint.x}" y2="${outerPoint.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  });

  // Barrier indicator
  const barrierInner = angleToCoords(barrierAngle, R_BLUE - BARRIER_TICK_LENGTH);
  const barrierOuter = angleToCoords(barrierAngle, R_BLUE + BARRIER_TICK_LENGTH);
  const barrierLabelPos = angleToCoords(barrierAngle, R_BLUE - 40);

  // Pointer
  const pointerLength = 200;
  const tipPoint = angleToCoords(pointerAngle, pointerLength);
  const headLeft = angleToCoords(pointerAngle - 15, pointerLength - 30);
  const headRight = angleToCoords(pointerAngle + 15, pointerLength - 30);
  const labelPos = angleToCoords(pointerAngle, pointerLength + 30);

  // Final hurdle indicator
  const finalPoint = angleToCoords(finalHurdleAngle, R_BLUE + 50);

  // Scale markers
  const scaleMarkers = [
    { angle: 0, label: '0%' }, { angle: 30, label: '+5%' },
    { angle: 90, label: '+30%' }, { angle: 120, label: '+50%' },
    { angle: -30, label: '-5%' }, { angle: -90, label: '-30%' },
    { angle: -120, label: '-50%' }
  ];
  let scaleMarkersStr = '';
  scaleMarkers.forEach(m => {
    const p = angleToCoords(m.angle, R_OUTER + 45);
    scaleMarkersStr += `<text x="${p.x}" y="${p.y}" fill="${colors.greyMid}" font-size="12" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Segoe UI, sans-serif">${m.label}</text>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${plan_name} - Dynamic Logo showing ${performance.toFixed(1)}% performance">
  <rect width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" fill="white"/>
  
  <!-- Scale markers -->
  ${scaleMarkersStr}
  
  <!-- 12:00 marker -->
  <line x1="${CENTER}" y1="${CENTER - R_OUTER - 10}" x2="${CENTER}" y2="${CENTER - R_OUTER - 30}" stroke="${colors.greenAccent}" stroke-width="4" stroke-linecap="round"/>
  
  <!-- Outer ring -->
  <g transform="rotate(${rotationAngle}, ${CENTER}, ${CENTER})">
    ${segments}
  </g>
  
  <!-- Blue ring -->
  <g transform="rotate(${rotationAngle}, ${CENTER}, ${CENTER})">
    <circle cx="${CENTER}" cy="${CENTER}" r="${R_BLUE}" fill="none" stroke="${colors.navy}" stroke-width="2" opacity="0.3"/>
    ${ticks}
  </g>
  
  <!-- Barrier -->
  <line x1="${barrierInner.x}" y1="${barrierInner.y}" x2="${barrierOuter.x}" y2="${barrierOuter.y}" stroke="${colors.barrierRed}" stroke-width="4" stroke-linecap="round"/>
  <text x="${barrierLabelPos.x}" y="${barrierLabelPos.y}" fill="${colors.barrierRed}" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${barrier_percent}%</text>
  
  <!-- Final hurdle -->
  <circle cx="${finalPoint.x}" cy="${finalPoint.y}" r="12" fill="${colors.finalPurple}"/>
  <text x="${finalPoint.x}" y="${finalPoint.y}" fill="white" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">F</text>
  
  <!-- Pointer -->
  <line x1="${CENTER}" y1="${CENTER}" x2="${tipPoint.x}" y2="${tipPoint.y}" stroke="${colors.navy}" stroke-width="6" stroke-linecap="round"/>
  <polygon points="${tipPoint.x},${tipPoint.y} ${headLeft.x},${headLeft.y} ${headRight.x},${headRight.y}" fill="${colors.navy}"/>
  <text x="${labelPos.x}" y="${labelPos.y}" fill="${colors.navy}" font-size="32" font-weight="bold" text-anchor="middle" dominant-baseline="middle">A</text>
  
  <!-- Centre dot -->
  <circle cx="${CENTER}" cy="${CENTER}" r="${CENTER_DOT_R}" fill="${centreColor}"/>
  ${is_called ? `<text x="${CENTER}" y="${CENTER}" fill="white" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">✓</text>` : ''}
  
  <!-- Data area -->
  <text x="${CENTER}" y="${CENTER + 80}" fill="${colors.navy}" font-size="14" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif">${counterparty}</text>
  ${is_called && called_date ? `<text x="${CENTER}" y="${CENTER + 100}" fill="${colors.greenAccent}" font-size="16" font-weight="bold" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif">Called: ${called_date}</text>` : ''}
  <text x="${CENTER}" y="${CENTER + (is_called ? 120 : 100)}" fill="${performance >= 0 ? colors.greenAccent : colors.barrierRed}" font-size="20" font-weight="bold" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif">${performance >= 0 ? '+' : ''}${performance.toFixed(1)}%</text>
  
  <!-- Wordmark -->
  <text x="${CENTER}" y="${CENTER + R_OUTER + 60}" fill="${colors.navy}" font-size="36" font-weight="bold" text-anchor="middle" font-family="Inter, Segoe UI, Source Sans Pro, sans-serif">Autocalls.uk</text>
  <text x="${CENTER}" y="${CENTER + R_OUTER + 90}" fill="${colors.greyMid}" font-size="18" text-anchor="middle" font-family="Inter, Segoe UI, Source Sans Pro, sans-serif">Precision Investing</text>
</svg>`;

  return svg;
}

/**
 * Main execution
 */
function main() {
  const outputDir = path.join(__dirname, '..', 'output');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate SVG
  const svg = generateStaticSVG(data);
  
  // Generate timestamp for filename
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Write SVG files
  const svgFilename = `logo_${timestamp}.svg`;
  const svgPath = path.join(outputDir, svgFilename);
  fs.writeFileSync(svgPath, svg);
  console.log(`Generated: ${svgPath}`);
  
  // Create latest symlink (or copy on Windows)
  const latestPath = path.join(outputDir, 'latest.svg');
  try {
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.copyFileSync(svgPath, latestPath);
    console.log(`Updated: ${latestPath}`);
  } catch (err) {
    console.log(`Note: Could not update latest symlink: ${err.message}`);
  }

  console.log(`\nStatic SVG generated successfully!`);
  console.log(`\nTo convert to PNG, you can use tools like:`);
  console.log(`  - Inkscape: inkscape ${svgPath} --export-type=png --export-width=512`);
  console.log(`  - ImageMagick: convert ${svgPath} -resize 512x512 logo_512.png`);
  console.log(`  - Or use a library like sharp or canvas in Node.js`);
}

main();
