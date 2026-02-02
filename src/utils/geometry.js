/**
 * Geometry utilities for Autocalls.uk Dynamic Logo
 * Handles angle calculations, pointer mapping, and collision avoidance
 */

// Constants from design tokens
export const VIEWBOX_SIZE = 1024;
export const CENTER = VIEWBOX_SIZE / 2;
export const R_OUTER = 420;
export const W_RING = 64;
export const R_BLUE = 330;
export const TICK_STROKE = 2;
export const TICK_LENGTH = 14;
export const BARRIER_TICK_LENGTH = 20;
export const MATURITY_MARK_LENGTH = 12;
export const POINTER_HEIGHT = 300;
export const CENTER_DOT_R = 48;
export const BOTTOM_ARROW_WIDTH = 120;

// Days in 10 years (exactly 365 days per year)
export const DAYS_IN_10_YEARS = 10 * 365;

// Angle per day for rotation (clockwise = positive)
export const ANGLE_PER_DAY = 360 / DAYS_IN_10_YEARS;

/**
 * Parse a date string to Date object
 */
export function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate, endDate) {
  const start = typeof startDate === 'string' ? parseDate(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDate(endDate) : endDate;
  const diffTime = end.getTime() - start.getTime();
  return diffTime / (1000 * 60 * 60 * 24);
}

/**
 * Calculate rotation angle based on elapsed days
 * Rotation is clockwise, so positive angles
 * 12:00 is 0° (top), angles increase clockwise
 */
export function calculateRotationAngle(startDate, currentDate) {
  const days = daysBetween(startDate, currentDate);
  return days * ANGLE_PER_DAY;
}

/**
 * Calculate when an observation tick should reach 12:00
 * Returns the angle offset from 12:00 based on observation date
 */
export function calculateObservationTickAngle(startDate, observationDate, currentDate) {
  const daysToObservation = daysBetween(startDate, observationDate);
  const angleAtObservation = daysToObservation * ANGLE_PER_DAY;
  
  // The tick should be positioned such that when rotation equals angleAtObservation,
  // the tick is at 12:00 (0°)
  // Current rotation angle
  const currentRotation = calculateRotationAngle(startDate, currentDate);
  
  // Tick's base position (before rotation)
  // When rotation = angleAtObservation, tick should be at 0°
  // So tick_base + rotation = 0° => tick_base = -angleAtObservation
  // But since we apply rotation to the whole ring, the tick position relative to ring is fixed
  // The tick's position on the ring = -angleAtObservation (counterclockwise from 12:00)
  return -angleAtObservation;
}

/**
 * Pointer 'A' piecewise linear mapping
 * Maps market performance percentage to clock angle
 * -50% = 8:00 (-120°)
 * -30% = 9:00 (-90°)
 * -15% = 10:00 (-60°)
 * -5% = 11:00 (-30°)
 * 0% = 12:00 (0°)
 * +5% = 1:00 (+30°)
 * +15% = 2:00 (+60°)
 * +30% = 3:00 (+90°)
 * +50% = 4:00 (+120°)
 */
export function mapPerformanceToAngle(performancePercent) {
  // Clamp to ±50%
  const pct = Math.max(-50, Math.min(50, performancePercent));
  
  // Piecewise linear mapping with breakpoints
  // Negative side: -50 to -30 to -15 to -5 to 0
  // Positive side: 0 to 5 to 15 to 30 to 50
  if (pct <= -30) {
    // -50% to -30%: maps to -120° to -90° (30° over 20%)
    return -90 + ((pct + 30) / 20) * 30; // slope: 1.5° per 1%
  } else if (pct <= -15) {
    // -30% to -15%: maps to -90° to -60° (30° over 15%)
    return -60 + ((pct + 15) / 15) * 30; // slope: 2° per 1%
  } else if (pct <= -5) {
    // -15% to -5%: maps to -60° to -30° (30° over 10%)
    return -30 + ((pct + 5) / 10) * 30; // slope: 3° per 1%
  } else if (pct <= 0) {
    // -5% to 0%: maps to -30° to 0° (30° over 5%)
    return (pct / 5) * 30; // slope: 6° per 1%
  } else if (pct <= 5) {
    // 0% to 5%: maps to 0° to 30° (30° over 5%)
    return (pct / 5) * 30; // slope: 6° per 1%
  } else if (pct <= 15) {
    // 5% to 15%: maps to 30° to 60° (30° over 10%)
    return 30 + ((pct - 5) / 10) * 30; // slope: 3° per 1%
  } else if (pct <= 30) {
    // 15% to 30%: maps to 60° to 90° (30° over 15%)
    return 60 + ((pct - 15) / 15) * 30; // slope: 2° per 1%
  } else {
    // 30% to 50%: maps to 90° to 120° (30° over 20%)
    return 90 + ((pct - 30) / 20) * 30; // slope: 1.5° per 1%
  }
}

/**
 * EaseOutQuad easing function
 */
export function easeOutQuad(t) {
  return t * (2 - t);
}

/**
 * Map barrier percentage to angle (same piecewise mapping as performance)
 * -50% = 8:00 (-120°)
 * -30% = 9:00 (-90°)
 * -15% = 10:00 (-60°)
 * -5% = 11:00 (-30°)
 * 0% = 12:00 (0°)
 * +5% = 1:00 (+30°)
 * +15% = 2:00 (+60°)
 * +30% = 3:00 (+90°)
 * +50% = 4:00 (+120°)
 */
export function mapBarrierToAngle(barrierPercent) {
  // Use the same piecewise linear mapping as performance
  return mapPerformanceToAngle(barrierPercent);
}

/**
 * Map hurdle percentage (relative-to-strike level, e.g. 100 = strike) to angle.
 * Mapping breakpoints (clock positions):
 * 50%  = 8:00  (-120°)
 * 70%  = 9:00  (-90°)
 * 85%  = 10:00 (-60°)
 * 95%  = 11:00 (-30°)
 * 100% = 12:00 (0°)
 * 105% = 1:00  (+30°)
 * 115% = 2:00  (+60°)
 * 130% = 3:00  (+90°)
 * 150% = 4:00  (+120°)
 */
export function mapHurdlePercentToAngle(hurdlePercent) {
  // Clamp to 50%..150%
  const pct = Math.max(50, Math.min(150, hurdlePercent));

  if (pct <= 70) {
    // 50% to 70%: -120° to -90° (30° over 20%)
    return -90 + ((pct - 70) / 20) * 30;
  } else if (pct <= 85) {
    // 70% to 85%: -90° to -60° (30° over 15%)
    return -60 + ((pct - 85) / 15) * 30;
  } else if (pct <= 95) {
    // 85% to 95%: -60° to -30° (30° over 10%)
    return -30 + ((pct - 95) / 10) * 30;
  } else if (pct <= 100) {
    // 95% to 100%: -30° to 0° (30° over 5%)
    return ((pct - 100) / 5) * 30;
  } else if (pct <= 105) {
    // 100% to 105%: 0° to 30° (30° over 5%)
    return ((pct - 100) / 5) * 30;
  } else if (pct <= 115) {
    // 105% to 115%: 30° to 60° (30° over 10%)
    return 30 + ((pct - 105) / 10) * 30;
  } else if (pct <= 130) {
    // 115% to 130%: 60° to 90° (30° over 15%)
    return 60 + ((pct - 115) / 15) * 30;
  } else {
    // 130% to 150%: 90° to 120° (30° over 20%)
    return 90 + ((pct - 130) / 20) * 30;
  }
}

/**
 * Calculate market performance percentage
 */
export function calculatePerformance(initialLevel, currentLevel) {
  return ((currentLevel - initialLevel) / initialLevel) * 100;
}

/**
 * Convert angle (degrees) to SVG coordinates
 * 0° = 12:00 (top), clockwise positive
 */
export function angleToCoords(angleDeg, radius, cx = CENTER, cy = CENTER) {
  // Convert to radians, adjust for SVG coordinate system
  // In SVG, 0° points right (3:00), and angles go clockwise
  // We want 0° to point up (12:00)
  const adjustedAngle = angleDeg - 90;
  const radians = (adjustedAngle * Math.PI) / 180;
  
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

/**
 * Generate SVG arc path
 */
export function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = angleToCoords(startAngle, radius, cx, cy);
  const end = angleToCoords(endAngle, radius, cx, cy);
  
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweepFlag = endAngle > startAngle ? 1 : 0;
  
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

/**
 * Collision avoidance for overlapping indicators
 * Returns adjusted angle and radial offset
 */
export function avoidCollision(angle, existingAngles, radialOffset = 6, angularJitter = 2) {
  let adjustedAngle = angle;
  let offset = 0;
  
  for (const existing of existingAngles) {
    const diff = Math.abs(normalizeAngle(angle - existing.angle));
    
    if (diff < 5) { // Within 5 degrees, apply avoidance
      // First try radial offset
      if (!existing.hasRadialOffset) {
        offset = radialOffset;
      } else {
        // Apply angular jitter
        adjustedAngle += angularJitter * (angle > existing.angle ? 1 : -1);
      }
    }
  }
  
  return { angle: adjustedAngle, radialOffset: offset };
}

/**
 * Normalize angle to -180 to 180 range
 */
export function normalizeAngle(angle) {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

/**
 * Generate segment path for outer ring
 * Each segment is 36° with gaps
 */
export function generateSegmentPath(segmentIndex, totalSegments, innerRadius, outerRadius, gapAngle = 3) {
  const segmentAngle = 360 / totalSegments;
  const startAngle = segmentIndex * segmentAngle + gapAngle / 2;
  const endAngle = (segmentIndex + 1) * segmentAngle - gapAngle / 2;
  
  const innerStart = angleToCoords(startAngle, innerRadius);
  const innerEnd = angleToCoords(endAngle, innerRadius);
  const outerStart = angleToCoords(startAngle, outerRadius);
  const outerEnd = angleToCoords(endAngle, outerRadius);
  
  const largeArc = segmentAngle - gapAngle > 180 ? 1 : 0;
  
  return `
    M ${innerStart.x} ${innerStart.y}
    A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}
    L ${outerEnd.x} ${outerEnd.y}
    A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerStart.x} ${outerStart.y}
    Z
  `;
}

/**
 * Check if a segment should be greyed (elapsed)
 * A segment is elapsed when its leading edge has crossed 12:00
 */
export function isSegmentElapsed(segmentIndex, totalSegments, rotationAngle) {
  const segmentAngle = 360 / totalSegments;
  const segmentLeadingEdge = (segmentIndex + 1) * segmentAngle;
  
  // The segment's leading edge position after rotation
  const rotatedEdge = normalizeAngle(segmentLeadingEdge + rotationAngle);
  
  // Check if it has crossed 12:00 (0°)
  // This is simplified - in reality need to track full rotations
  return rotationAngle >= segmentLeadingEdge;
}

/**
 * Format date for display
 */
export function formatDate(dateStr) {
  const date = parseDate(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
