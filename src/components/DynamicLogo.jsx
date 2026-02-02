import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  ANGLE_PER_DAY,
  calculateRotationAngle,
  calculatePerformance,
  mapPerformanceToAngle,
  mapBarrierToAngle,
  mapHurdlePercentToAngle,
  daysBetween
} from '../utils/geometry';

/**
 * DynamicLogo Component
 * Renders the Autocalls.uk dynamic logo matching the original design exactly
 * Green outer ring, navy blue inner ring, stylized "A" with arrow
 */
const DynamicLogo = ({ data, animate = true, size = 512, debug = false }) => {
  const svgRef = useRef(null);
  const outerRingRef = useRef(null);
  const blueRingRef = useRef(null);
  const pointerARef = useRef(null);

  // ViewBox and geometry constants matching original logo proportions
  const VIEWBOX = 512;
  const CENTER = VIEWBOX / 2;
  
  // Ring dimensions - matched to original logo
  const R_OUTER = 220;        // Outer radius of green ring
  const R_OUTER_INNER = 180;  // Inner radius of green ring  
  const R_BLUE = 155;         // Center radius of blue ring
  const BLUE_STROKE = 22;     // Thickness of blue ring

  // Extract data
  const {
    plan_name,
    tenor_years,
    start_date,
    current_date,
    initial_strike_level,
    current_level,
    barrier_percent,
    observations,
    counterparty,
    is_called,
    called_date,
    brand_colours,
    design_tokens,
    bottom_arrow_target = 0,
    circle_fill = '#FFFFFF'
  } = data;

  // Colors from brand - matching original logo exactly
  const colors = {
    navy: '#0b3763',
    greenPrimary: '#107b44',
    greenAccent: '#0FA15A',
    barrierRed: brand_colours?.barrier_red || '#C62828',
    finalPurple: brand_colours?.final_hurdle_purple || '#5E35B1',
    greyLight: brand_colours?.grey_light || '#D9D9D9',
    greyMid: brand_colours?.grey_mid || '#A6A6A6',
    white: '#FFFFFF'
  };

  // Design tokens
  const gapAngle = design_tokens?.gap_angle_deg || 5;

  // Calculate current values
  const rotationAngle = calculateRotationAngle(start_date, current_date);
  // Performance is calculated as percentage change: (current_level - initial_strike_level) / initial_strike_level * 100
  const performance = calculatePerformance(initial_strike_level, current_level);
  
  // Calculate pointer angle directly from performance (no snapping)
  const pointerAngle = mapPerformanceToAngle(performance);
  
  // Calculate barrier angle from barrier_percent
  // Range: -50% to +50%
  // -50% = 8 o'clock (-120°), 0% = 12 o'clock (0°), +50% = 4 o'clock (+120°)
  const barrierAngle = (() => {
    const num = Number(barrier_percent);
    if (!Number.isFinite(num)) return 0; // default to 12 o'clock if invalid
    return mapBarrierToAngle(num);
  })();

  // Helper: convert angle to radians (0° = 12 o'clock, clockwise positive)
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  
  // Helper: get x,y coordinates from angle and radius
  const polarToCart = (angle, radius) => ({
    x: CENTER + radius * Math.cos(toRad(angle)),
    y: CENTER + radius * Math.sin(toRad(angle))
  });

  // Animation setup
  // Animation setup - segment positions are calculated based on elapsed time
  // The GSAP rotation is only for smooth real-time animation effect (imperceptibly slow)
  // The actual segment coloring is computed from dates, not rotation
  useEffect(() => {
    if (!animate || is_called) return;

    const ctx = gsap.context(() => {
      // No initial rotation needed - segments are positioned by date calculation
      // Real-time rotation is 10 years for full cycle - practically static
      const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60;
      
      // Blue ring can still have subtle rotation for effect (optional)
      gsap.to(blueRingRef.current, {
        rotation: `+=${360}`,
        duration: tenYearsInSeconds,
        ease: 'none',
        repeat: -1,
        svgOrigin: `${CENTER} ${CENTER}`
      });
    }, svgRef);

    return () => ctx.revert();
  }, [animate, is_called]);

  // For non-animated state - no rotation needed since segments are positioned by date
  useEffect(() => {
    // Segments are positioned based on elapsed time calculation, not rotation
    // No GSAP rotation needed for outer ring
  }, [animate, is_called]);

  // Generate outer ring segment path - simple arc segments
  const generateSegmentPath = (index, total, innerR, outerR, gap) => {
    const segmentAngle = 360 / total;
    const startAngle = index * segmentAngle + gap / 2;
    const endAngle = (index + 1) * segmentAngle - gap / 2;
    
    const innerStart = polarToCart(startAngle, innerR);
    const innerEnd = polarToCart(endAngle, innerR);
    const outerStart = polarToCart(startAngle, outerR);
    const outerEnd = polarToCart(endAngle, outerR);
    
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    
    return `M ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y} L ${outerEnd.x} ${outerEnd.y} A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerStart.x} ${outerStart.y} Z`;
  };

  // Generate partial segment path with exact start and end angles
  // Ensures arcs always curve outward (clockwise on outer, counterclockwise on inner)
  const generatePartialSegmentPath = (startAngle, endAngle, innerR, outerR) => {
    // Ensure startAngle < endAngle for proper arc direction
    if (startAngle > endAngle) {
      [startAngle, endAngle] = [endAngle, startAngle];
    }
    
    const innerStart = polarToCart(startAngle, innerR);
    const innerEnd = polarToCart(endAngle, innerR);
    const outerStart = polarToCart(startAngle, outerR);
    const outerEnd = polarToCart(endAngle, outerR);
    
    const arcSpan = endAngle - startAngle;
    const largeArc = arcSpan > 180 ? 1 : 0;
    
    // Path: inner arc (clockwise), line to outer, outer arc (counterclockwise), line back
    return `M ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y} L ${outerEnd.x} ${outerEnd.y} A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerStart.x} ${outerStart.y} Z`;
  };

  // Render outer ring segments
  // The ring represents tenor_years of the plan starting from start_date
  // 12 o'clock (0°) = "NOW" - always falls WITHIN the current year's bar
  // Each bar represents a COMPLETE calendar year: January to December
  // The gap between bars is purely visual - it doesn't represent time
  // Bar size is CONSTANT (31° arc) regardless of tenor_years
  const renderOuterRing = () => {
    const segments = [];
    const yearLabels = [];
    
    const startDateObj = new Date(start_date);
    const currentDateObj = new Date(current_date);
    
    // Validate dates
    if (isNaN(startDateObj.getTime()) || isNaN(currentDateObj.getTime())) {
      console.warn('Invalid date detected');
      return <g ref={outerRingRef}></g>;
    }
    
    // Limit to max 10 years
    const maxYears = Math.min(tenor_years, 10);
    
    // Calculate end date: start_date + tenor_years
    const endDateObj = new Date(startDateObj);
    endDateObj.setFullYear(endDateObj.getFullYear() + tenor_years);
    
    // Calculate total days in the entire tenor period (accounts for leap years)
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDaysInTenor = Math.round((endDateObj.getTime() - startDateObj.getTime()) / msPerDay);
    
    // Calculate exact average days per segment
    const daysPerSegment = totalDaysInTenor / tenor_years;
    
    // Helper to calculate plan year start/end dates
    // Plan Year 0: start_date to start_date + 12 months - 1 day
    // Plan Year 1: start_date + 12 months to start_date + 24 months - 1 day
    // etc.
    const getPlanYearDates = (yearIndex) => {
      const yearStart = new Date(startDateObj);
      yearStart.setFullYear(yearStart.getFullYear() + yearIndex);
      const yearEnd = new Date(startDateObj);
      yearEnd.setFullYear(yearEnd.getFullYear() + yearIndex + 1);
      yearEnd.setDate(yearEnd.getDate() - 1); // Last day of plan year
      return { start: yearStart, end: yearEnd };
    };
    
    // Helper: actual days in a specific plan year (for positioning observations accurately)
    const getActualDaysInPlanYear = (yearIndex) => {
      const { start, end } = getPlanYearDates(yearIndex);
      return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
    };
    
    // Calculate bar size for 10-year display and keep it constant for all tenor lengths
    // Total = 10 * barArc + 10 * gapArc = 360°
    const barArc = (360 - 10 * gapAngle) / 10; // Constant bar size based on 10-year circle
    
    // Which plan year are we currently in? (0-indexed) — use actual date ranges so leap years are correct
    const currentPlanYearIndex = (() => {
      for (let i = 0; i < maxYears; i++) {
        const { start, end } = getPlanYearDates(i);
        if (currentDateObj >= start && currentDateObj <= end) return i;
      }
      return Math.min(Math.max(0, maxYears - 1), maxYears - 1);
    })();
    
    // How far through the CURRENT PLAN YEAR are we? (0 = start of plan year, 1 = end)
    const currentPlanYear = getPlanYearDates(currentPlanYearIndex);
    const nextPlanYearStart = new Date(currentPlanYear.start);
    nextPlanYearStart.setFullYear(nextPlanYearStart.getFullYear() + 1);
    const planYearDuration = nextPlanYearStart - currentPlanYear.start;
    const progressInCurrentYear = planYearDuration > 0 
      ? Math.max(0, Math.min(1, (currentDateObj - currentPlanYear.start) / planYearDuration))
      : 0.5;
    
    for (let yearIndex = 0; yearIndex < maxYears; yearIndex++) {
      // Plan year label (Year 1, Year 2, etc. or the actual start year of that plan year)
      const planYearDates = getPlanYearDates(yearIndex);
      const yearNumber = `Y${yearIndex + 1}`;
      
      // Calculate bar position relative to 12 o'clock (0°)
      // The current plan year's bar straddles 0° based on progress
      
      let barStart, barEnd; // barStart is the left edge (more negative), barEnd is the right edge (more positive)
      
      if (yearIndex === currentPlanYearIndex) {
        // Current plan year - straddles 12 o'clock
        // Elapsed portion (grey): from 0° to the right (+)
        // Remaining portion (green): from 0° to the left (-)
        const elapsedArc = progressInCurrentYear * barArc;
        const remainingArc = (1 - progressInCurrentYear) * barArc;
        barStart = -remainingArc; // Left edge (green side)
        barEnd = elapsedArc;      // Right edge (grey side)
      } else if (yearIndex < currentPlanYearIndex) {
        // Past plan years - entirely on right side (positive angles, grey)
        const yearsAgo = currentPlanYearIndex - yearIndex;
        const currentElapsedArc = progressInCurrentYear * barArc;
        const startOffset = currentElapsedArc + gapAngle + (yearsAgo - 1) * (barArc + gapAngle);
        barStart = startOffset;
        barEnd = startOffset + barArc;
      } else {
        // Future plan years - entirely on left side (negative angles, green)
        const yearsAhead = yearIndex - currentPlanYearIndex;
        const currentRemainingArc = (1 - progressInCurrentYear) * barArc;
        const endOffset = currentRemainingArc + gapAngle + (yearsAhead - 1) * (barArc + gapAngle);
        barEnd = -endOffset;
        barStart = -endOffset - barArc;
      }
      
      // No clipping - allow bars to go full circle
      // Normalize angles to handle wrapping around 360°
      const normalizeAngle = (angle) => {
        while (angle > 180) angle -= 360;
        while (angle <= -180) angle += 360;
        return angle;
      };
      
      // Use unclipped angles for full circle support
      const clippedStart = barStart;
      const clippedEnd = barEnd;
      
      // Skip tiny segments
      if (Math.abs(clippedEnd - clippedStart) < 1) continue;
      
      // Get actual days in this specific plan year (for reference)
      const actualDaysThisYear = getActualDaysInPlanYear(yearIndex);
      
      // Add label at midpoint of the bar
      const labelAngle = (barStart + barEnd) / 2;
      const labelRadius = R_OUTER + 15;
      const labelPos = polarToCart(labelAngle, labelRadius);
      yearLabels.push(
        <g key={`segment-label-${yearIndex}`}>
          <text
            x={labelPos.x}
            y={labelPos.y}
            fill={colors.navy}
            fontSize="10"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {yearNumber}
          </text>
          {/* In debug mode, show both the average days per segment and actual days for this year */}
          {debug && (
            <>
              <text
                x={labelPos.x}
                y={labelPos.y + 12}
                fill={colors.greenPrimary}
                fontSize="8"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {daysPerSegment.toFixed(2)} d/seg
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 22}
                fill={colors.navy}
                fontSize="8"
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={0.7}
              >
                (actual: {actualDaysThisYear}d)
              </text>
            </>
          )}
        </g>
      );
      
      // Determine color based on year index
      if (yearIndex === currentPlanYearIndex) {
        // Current plan year - split at 0° (12 o'clock)
        // Green part (remaining): negative angles (left of 12 o'clock)
        // Grey part (elapsed): positive angles (right of 12 o'clock)
        
        if (barStart < 0) {
          segments.push(
            <path
              key={`future-current-${yearIndex}`}
              d={generatePartialSegmentPath(barStart, Math.min(0, barEnd), R_OUTER_INNER, R_OUTER)}
              fill={colors.greenPrimary}
            />
          );
        }
        
        if (barEnd > 0) {
          segments.push(
            <path
              key={`past-current-${yearIndex}`}
              d={generatePartialSegmentPath(Math.max(0, barStart), barEnd, R_OUTER_INNER, R_OUTER)}
              fill={colors.greyMid}
              opacity={0.6}
            />
          );
        }
      } else if (yearIndex < currentPlanYearIndex) {
        // Past plan year - grey (can wrap around 6 o'clock)
        // Check if bar crosses the ±180° boundary
        if (barStart <= 180 && barEnd > 180) {
          // Bar wraps from right side past 6 o'clock
          segments.push(
            <path
              key={`past-${yearIndex}-a`}
              d={generatePartialSegmentPath(barStart, 180, R_OUTER_INNER, R_OUTER)}
              fill={colors.greyMid}
              opacity={0.6}
            />
          );
          segments.push(
            <path
              key={`past-${yearIndex}-b`}
              d={generatePartialSegmentPath(-180, barEnd - 360, R_OUTER_INNER, R_OUTER)}
              fill={colors.greyMid}
              opacity={0.6}
            />
          );
        } else {
          segments.push(
            <path
              key={`past-${yearIndex}`}
              d={generatePartialSegmentPath(barStart, barEnd, R_OUTER_INNER, R_OUTER)}
              fill={colors.greyMid}
              opacity={0.6}
            />
          );
        }
      } else {
        // Future plan year - green (can wrap around 6 o'clock)
        // Check if bar crosses the ±180° boundary
        if (barEnd >= -180 && barStart < -180) {
          // Bar wraps from left side past 6 o'clock
          segments.push(
            <path
              key={`future-${yearIndex}-a`}
              d={generatePartialSegmentPath(-180, barEnd, R_OUTER_INNER, R_OUTER)}
              fill={colors.greenPrimary}
            />
          );
          segments.push(
            <path
              key={`future-${yearIndex}-b`}
              d={generatePartialSegmentPath(barStart + 360, 180, R_OUTER_INNER, R_OUTER)}
              fill={colors.greenPrimary}
            />
          );
        } else {
          segments.push(
            <path
              key={`future-${yearIndex}`}
              d={generatePartialSegmentPath(barStart, barEnd, R_OUTER_INNER, R_OUTER)}
              fill={colors.greenPrimary}
            />
          );
        }
      }
    }

    // Generate trigger arrows bound to their respective plan year segments
    const triggerArrows = [];
    const arrowLength = R_OUTER - R_OUTER_INNER;
    
    // Find the final (future-most) observation index
    const finalObsIndex = observations.reduce((maxIdx, obs, idx, arr) => {
      if (maxIdx === -1) return idx;
      return new Date(obs.date) > new Date(arr[maxIdx].date) ? idx : maxIdx;
    }, -1);
    
    // Helper: which plan year (0-indexed) a date falls into
    const getPlanYearIndexForDate = (date) => {
      const d = new Date(date);
      for (let i = 0; i < maxYears; i++) {
        const { start, end } = getPlanYearDates(i);
        if (d >= start && d <= end) return i;
      }
      return -1;
    };
    
    observations.forEach((obs, index) => {
      const obsDate = new Date(obs.date);
      
      // Determine which plan year this observation falls into (handles leap years)
      const yearIndex = getPlanYearIndexForDate(obsDate);
      
      // If outside tenor range, skip
      if (yearIndex < 0 || yearIndex >= maxYears) return;
      
      // Calculate position within the plan year (0 = start, 1 = end)
      const planYearDates = getPlanYearDates(yearIndex);
      const yearDuration = planYearDates.end.getTime() - planYearDates.start.getTime() + 24 * 60 * 60 * 1000; // full days in ms
      const progressInYear = yearDuration > 0 
        ? (obsDate - planYearDates.start) / yearDuration 
        : 0.5;
      
      // Calculate bar position using same logic as segments
      let barStart, barEnd;
      
      if (yearIndex === currentPlanYearIndex) {
        // Current plan year - straddles 12 o'clock
        const elapsedArc = progressInCurrentYear * barArc;
        const remainingArc = (1 - progressInCurrentYear) * barArc;
        barStart = -remainingArc;
        barEnd = elapsedArc;
      } else if (yearIndex < currentPlanYearIndex) {
        // Past plan year - on the right side (positive angles)
        const yearsAgo = currentPlanYearIndex - yearIndex;
        const currentElapsedArc = progressInCurrentYear * barArc;
        const startOffset = currentElapsedArc + gapAngle + (yearsAgo - 1) * (barArc + gapAngle);
        barStart = startOffset;
        barEnd = startOffset + barArc;
      } else {
        // Future plan year - on the left side (negative angles)
        const yearsAhead = yearIndex - currentPlanYearIndex;
        const currentRemainingArc = (1 - progressInCurrentYear) * barArc;
        const endOffset = currentRemainingArc + gapAngle + (yearsAhead - 1) * (barArc + gapAngle);
        barEnd = -endOffset;
        barStart = -endOffset - barArc;
      }
      
      // Interpolate angle within the bar based on progress within that plan year
      // Start of plan year (0%) at right edge (barEnd), end (100%) at left edge (barStart)
      let obsAngle = barEnd - progressInYear * (barEnd - barStart);
      
      // Normalize angle to -180 to 180 range for rendering (allows full circle)
      while (obsAngle > 180) obsAngle -= 360;
      while (obsAngle < -180) obsAngle += 360;
      
      // Arrow positioned at outer edge, pointing inward
      const outerRadius = R_OUTER;
      const innerRadius = R_OUTER_INNER;
      
      const tipPos = polarToCart(obsAngle, innerRadius);
      const baseLeftPos = polarToCart(obsAngle - 2, outerRadius);
      const baseRightPos = polarToCart(obsAngle + 2, outerRadius);
      
      const midRadius = innerRadius + arrowLength * 0.4;
      const midLeftPos = polarToCart(obsAngle - 0.8, midRadius);
      const midRightPos = polarToCart(obsAngle + 0.8, midRadius);
      
      // Determine fill: 
      // - Final observation (future-most): amber-to-blue gradient
      // - Past observations: grey
      // - Future observations: sky blue
      const isPast = obsDate < currentDateObj;
      const isFinalObs = index === finalObsIndex;
      const arrowFill = isFinalObs ? 'url(#finalObsGradient)' : (isPast ? colors.greyMid : '#87CEEB');
      const arrowStroke = colors.navy; // All observation markers have navy border
      
      triggerArrows.push(
        <polygon
          key={`trigger-arrow-${index}`}
          points={`
            ${tipPos.x},${tipPos.y}
            ${midLeftPos.x},${midLeftPos.y}
            ${baseLeftPos.x},${baseLeftPos.y}
            ${baseRightPos.x},${baseRightPos.y}
            ${midRightPos.x},${midRightPos.y}
          `}
          fill={arrowFill}
          stroke={arrowStroke}
          strokeWidth={1.5}
        />
      );
    });

    // Debug panel showing total days calculation
    const debugPanel = debug ? (
      <g>
        {/* Background for debug info */}
        <rect 
          x={CENTER - 100} 
          y={CENTER + 240} 
          width={200} 
          height={55} 
          fill="white" 
          stroke={colors.navy} 
          strokeWidth={1} 
          rx={4}
          opacity={0.95}
        />
        <text x={CENTER} y={CENTER + 255} fill={colors.navy} fontSize="9" fontWeight="bold" textAnchor="middle">
          Outer Segment Calculation
        </text>
        <text x={CENTER} y={CENTER + 268} fill={colors.navy} fontSize="8" textAnchor="middle">
          Start: {start_date} | End: {endDateObj.toISOString().split('T')[0]}
        </text>
        <text x={CENTER} y={CENTER + 280} fill={colors.greenPrimary} fontSize="8" textAnchor="middle">
          Total Days: {totalDaysInTenor} | Tenor: {tenor_years} yrs
        </text>
        <text x={CENTER} y={CENTER + 292} fill={colors.greenPrimary} fontSize="9" fontWeight="bold" textAnchor="middle">
          Days per Segment: {daysPerSegment.toFixed(4)}
        </text>
      </g>
    ) : null;

    return (
      <g 
        ref={outerRingRef}
      >
        {segments}
        {triggerArrows}
        {debug && yearLabels}
        {debugPanel}
      </g>
    );
  };

  // Render a line at the current date (12 o'clock position for testing/visualization)
  const renderCurrentDateLine = () => {
    // Current date is always at 12 o'clock (0°), which is the dividing line between past and future
    const lineStartRadius = R_OUTER_INNER - 5; // Start just inside the green ring
    const lineEndRadius = R_OUTER + 25; // End outside the green ring
    
    const startPos = polarToCart(0, lineStartRadius); // 0° = 12 o'clock
    const endPos = polarToCart(0, lineEndRadius);
    
    return (
      <g>
        <line
          x1={startPos.x}
          y1={startPos.y}
          x2={endPos.x}
          y2={endPos.y}
          stroke="#FF0000"
          strokeWidth={2}
          strokeDasharray="4,2"
        />
        <text
          x={endPos.x}
          y={endPos.y - 8}
          fill="#FF0000"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
        >
          NOW
        </text>
      </g>
    );
  };

  // Render blue ring - just the ring, radial marks are rendered separately (static)
  const renderBlueRing = () => {
    return (
      <g 
        ref={blueRingRef}
      >
        {/* Navy blue ring circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R_BLUE}
          fill="none"
          stroke={colors.navy}
          strokeWidth={BLUE_STROKE}
        />
      </g>
    );
  };

  // Render the two level indicator arrows on the blue ring
  // 1. Next Observation arrow - green filled arrow with dark green border (based on next observation's hurdle_percent)
  // 2. Final Index Level - white filled arrow with green outline (based on final observation hurdle_percent)
  const renderLevelArrows = () => {
    const arrowLength = 20;
    const arrowWidth = 8;
    const arrowRadius = R_BLUE; // On the blue ring
    
    const currentDateObj = new Date(current_date);
    
    // Find the next upcoming observation from current date
    const nextObservation = (() => {
      if (!observations || !observations.length) return null;
      const futureObs = observations
        .filter(obs => new Date(obs.date) > currentDateObj)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return futureObs.length > 0 ? futureObs[0] : null;
    })();
    
    // Calculate angle for the next observation arrow based on its hurdle_percent
    // hurdle_percent mapping:
    // 50%=8:00, 70%=9:00, 85%=10:00, 95%=11:00, 100%=12:00,
    // 105%=1:00, 115%=2:00, 130%=3:00, 150%=4:00
    const nextObsAngle = (() => {
      if (!nextObservation) return null;
      const hurdlePercent = nextObservation.hurdle_percent;
      if (!Number.isFinite(hurdlePercent)) return null;
      return mapHurdlePercentToAngle(hurdlePercent);
    })();
    
    // Final index level as percentage (e.g., 80% = -20% performance, 100% = 0%)
    const finalIndexLevel = (() => {
      if (observations && observations.length) {
        const lastObs = observations.reduce((latest, obs) => {
          if (!latest) return obs;
          return new Date(obs.date) > new Date(latest.date) ? obs : latest;
        }, null);
        if (lastObs && Number.isFinite(lastObs.hurdle_percent)) return lastObs.hurdle_percent;
      }
      return 100; // fallback
    })();
    const finalIndexAngle = mapHurdlePercentToAngle(finalIndexLevel || 100);
    
    // Helper to create arrow pointing inward at a given angle
    // isLarge = true for last call arrow (green), false for next call arrow (white)
    const createArrow = (angle, fillColor, strokeColor, isLarge = false) => {
      // Arrow sits on the blue ring, pointing toward center
      const lengthMultiplier = isLarge ? 1.4 : 1.0; // Last call arrow is 40% larger
      const widthMultiplier = isLarge ? 1.3 : 1.0;
      const outerRadius = arrowRadius + BLUE_STROKE/2 + 2;
      const innerRadius = outerRadius - (arrowLength * lengthMultiplier);
      
      // Calculate arrow points
      const tip = polarToCart(angle, innerRadius);
      const baseLeft = polarToCart(angle - (3 * widthMultiplier), outerRadius);
      const baseRight = polarToCart(angle + (3 * widthMultiplier), outerRadius);
      
      // Notch for arrow shape
      const notchRadius = innerRadius + (arrowLength * lengthMultiplier) * 0.35;
      const notchLeft = polarToCart(angle - (1.2 * widthMultiplier), notchRadius);
      const notchRight = polarToCart(angle + (1.2 * widthMultiplier), notchRadius);
      
      return (
        <polygon
          points={`
            ${tip.x},${tip.y}
            ${notchLeft.x},${notchLeft.y}
            ${baseLeft.x},${baseLeft.y}
            ${baseRight.x},${baseRight.y}
            ${notchRight.x},${notchRight.y}
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      );
    };
    
    return (
      <g>
        {/* Next Observation arrow - green filled with dark green border - LARGER */}
        {/* Only render if there is a next observation */}
        {nextObsAngle !== null && createArrow(nextObsAngle, colors.greenAccent, '#0A5C2F', true)}
        
        {/* Final Index Level arrow (Next Call) - white filled with green outline */}
        {createArrow(finalIndexAngle, colors.white, colors.greenPrimary, false)}
      </g>
    );
  };

  // Render the 8 static radial marks INSIDE the blue ring (like the original logo)
  // Positions: 1, 2, 3, 4 o'clock on right side and 8, 9, 10, 11 o'clock on left side
  const renderRadialMarks = () => {
    const tickWidth = 21-11;  // Width (perpendicular to radius)
    const tickHeight = 27-13; // Height (along the radius, pointing to center)
    const tickRadius = R_BLUE - BLUE_STROKE/2 - 18; // Inside the blue ring
    
    // 8 marks: 1, 2, 3, 4 o'clock (30°, 60°, 90°, 120°) and 8, 9, 10, 11 o'clock (240°, 270°, 300°, 330°)
    const angles = [30, 60, 90, 120, 240, 270, 300, 330];
    
    return (
      <g>
        {angles.map((angle, i) => {
          const pos = polarToCart(angle, tickRadius);
          // Rotate so the longer dimension (height) points toward center
          return (
            <rect
              key={`radial-mark-${i}`}
              x={pos.x - tickWidth / 2}
              y={pos.y - tickHeight / 2}
              width={tickWidth}
              height={tickHeight}
              fill={colors.greenPrimary}
              transform={`rotate(${angle}, ${pos.x}, ${pos.y})`}
            />
          );
        })}
      </g>
    );
  };

  // Render the stylized "A" pointer - using original SVG paths scaled and centered
  const renderPointerA = () => {
    // Original SVG viewBox: 1675.34 x 1692.16, center approx (846, 846)
    // Our viewBox: 512 x 512, center 256
    // Scale factor: 512/1675 ≈ 0.306, but we want the A to fit inside the blue ring
    // The A should fit within radius ~120 from center
    const scale = 0.3;
    const origCenterX = 846;
    const origCenterY = 846;
    
    // Transform function to scale and translate original coordinates
    const transform = (x, y) => ({
      x: CENTER + (x - origCenterX) * scale,
      y: CENTER + (y - origCenterY) * scale
    });
    
    return (
      <g 
        ref={pointerARef}
        transform={`rotate(${pointerAngle}, ${CENTER}, ${CENTER})`}
      >
        {/* Main "A" shape from original SVG - the outer letter form */}
        <path
          d="M792.6,590.92c-7.44-5.32-15.39-1.14-23.85-3.62,24.41-52.5,48.78-104.68,73.09-156.93.78,0,1.5-.05,2.27-.05Q880.28,509,916.75,588.18c-8.31,3.41-16.88-2.73-24.94,3.15,79.66,171,157,343,241,513.12-3.45.26-5.57.51-7.74.51-30.15.06-60.34-.2-90.49.21-6.56.1-9.81-1.86-12.65-7.85-14.4-30.14-29.53-60-44-90.08-2.84-5.83-6.2-8-12.8-8-81.67.26-163.28.16-245,.16h-8Q686,1052.1,660,1104.55H554.1Q673.67,847.24,792.6,590.92Z"
          fill={colors.navy}
          transform={`translate(${CENTER - origCenterX * scale}, ${CENTER - origCenterY * scale}) scale(${scale})`}
        />
        
        {/* Inner triangle/teardrop cutout path */}
        <path
          d="M844.27,698.81l-2.37.15q-49.1,106.86-98.34,213.82c9.7,2.22,37.89,2,45.78-.26,1.24-16.21,6.77-30.87,18.85-42.64s26.32-17.81,43.2-18.17c15.08-.36,28.29,4.28,40.11,13.42,15.8,12.23,22.51,29.22,24.63,48.42h23.69C907.66,841.23,876,770,844.27,698.81Z"
          fill={colors.white}
          stroke="none"
          transform={`translate(${CENTER - origCenterX * scale}, ${CENTER - origCenterY * scale}) scale(${scale})`}
        />
        {/* White triangle overlay matching the cutout */}
        <polygon
          points={[
            // Approximate triangle vertices based on the cutout path
            `${CENTER},${CENTER - 130 * scale}`,
            `${CENTER - 85 * scale},${CENTER + 67.8 * scale}`,
            `${CENTER + 80 * scale},${CENTER + 67.8 * scale}`
          ].join(' ')}
          fill={colors.white}
          stroke="none"
        />
          {/* White dot with navy border touching the base of the triangle */}
        <circle
          cx={CENTER-1}
          cy={CENTER + 70 * scale - 12 * scale}
          r={60 * scale}
          fill={circle_fill}
          stroke={colors.navy}
          strokeWidth={10 * scale}
        />
        
      </g>
    );
  };

  // Calculate the angle from arrow center to target point on the circle
  // This accounts for the arrow not being at the center of the circle
  const calculateDirectionToTarget = (arrowCenterAngle, arrowCenterRadius, targetAngle, targetRadius) => {
    // Arrow center position
    const arrowCenter = polarToCart(arrowCenterAngle, arrowCenterRadius);
    // Target position on circle
    const target = polarToCart(targetAngle, targetRadius);
    
    // Direction vector from arrow center to target
    const dx = target.x - arrowCenter.x;
    const dy = target.y - arrowCenter.y;
    
    // Angle in standard math coords (0=right, CCW positive)
    const mathAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Convert to our system (0=12 o'clock, CW positive): add 90
    return mathAngle + 90;
  };

  // Render bottom green arrow
  // - Positioned relative to the A pointer (moves with it around the logo center)
  // - Rotates on its own axis to always point at bottom_arrow_target (0-360° clockwise on circle)
  // - 0° = 12 o'clock, 90° = 3 o'clock, 180° = 6 o'clock, 270° = 9 o'clock
  const renderBottomArrow = () => {
    const arrowColor = data.bottom_arrow_color || colors.greenPrimary;
    const scale = 0.28;
    const offsetY = 10;

    // Target angle on the circle (0-360, clockwise from 12 o'clock)
    const targetAngle = Number(bottom_arrow_target) || 0;
    
    // Arrow center is at 180° from pointerAngle (below the A), at radius ~81
    const arrowCenterRadius = (1100 - 846) * scale + offsetY; // ≈ 81
    const arrowCenterAngle = pointerAngle + 180;
    
    // Calculate actual direction from arrow center to target on circle
    const directionToTarget = calculateDirectionToTarget(arrowCenterAngle, arrowCenterRadius, targetAngle, R_BLUE);
    
    // Arrow path default pointing direction in local coords (may need adjustment based on path shape)
    // 0 = path points UP (12 o'clock), adjust if arrow shape points differently
    const ARROW_PATH_DEFAULT_ANGLE = 0;
    
    // After group rotation by pointerAngle, arrow points at (pointerAngle + ARROW_PATH_DEFAULT_ANGLE)
    // Local rotation needed to point at the calculated direction
    const localRotation = directionToTarget - pointerAngle - ARROW_PATH_DEFAULT_ANGLE;

    // Arrow's local axis in original SVG coordinate space
    const arrowAxisX = 846;
    const arrowAxisY = 1100;

    return (
      <g transform={`rotate(${pointerAngle}, ${CENTER}, ${CENTER})`}>
        {/* Position + scale in original SVG coordinate space */}
        <g transform={`translate(${CENTER - 846 * scale}, ${CENTER - 846 * scale + offsetY}) scale(${scale})`}>
          {/* Rotate on own axis to point at target angle on circle */}
          <g transform={`rotate(${localRotation}, ${arrowAxisX}, ${arrowAxisY})`}>
            <path
              d="M930.37,1175.38l-44.8-13.84c-12.5-3.87-25-7.54-37.43-11.72-5.57-1.91-10.63-1.6-16.16.21-24.21,8-48.47,15.74-72.78,23.54-2.38.77-4.86,1.39-9.14,2.58,30.82-46.51,60.55-91.37,91.16-137.62L931.41,1174C931.05,1174.45,930.74,1174.91,930.37,1175.38Z"
              fill={arrowColor}
            />
          </g>
        </g>
      </g>
    );
  };

  // Debug lines for bottom arrow (only shown in debug mode)
  // Line 1 (orange dashed): from arrow center to target point on circle - where it SHOULD point
  // Line 2 (green solid): from arrow center - where arrow IS actually pointing after rotation
  const renderBottomArrowDebugLines = () => {
    if (!debug) return null;
    
    const scale = 0.28;
    const offsetY = 10;
    const targetAngle = Number(bottom_arrow_target) || 0;
    
    // Arrow center position (same calculation as in renderBottomArrow)
    const arrowCenterRadius = (1100 - 846) * scale + offsetY;
    const arrowCenterAngle = pointerAngle + 180;
    const arrowCenter = polarToCart(arrowCenterAngle, arrowCenterRadius);
    
    // Target point on circle
    const target = polarToCart(targetAngle, R_BLUE);
    
    // Calculate the direction arrow should point
    const directionToTarget = calculateDirectionToTarget(arrowCenterAngle, arrowCenterRadius, targetAngle, R_BLUE);
    
    // The actual local rotation applied (same as in renderBottomArrow)
    const ARROW_PATH_DEFAULT_ANGLE = 0;
    const localRotation = directionToTarget - pointerAngle - ARROW_PATH_DEFAULT_ANGLE;
    
    // Where the arrow is actually pointing after rotation = pointerAngle + localRotation + ARROW_PATH_DEFAULT_ANGLE
    const actualArrowDirection = pointerAngle + localRotation + ARROW_PATH_DEFAULT_ANGLE;
    
    // Extend lines from arrow center to outer ring
    const targetLineEnd = polarToCart(directionToTarget, R_OUTER);
    const actualLineEnd = polarToCart(actualArrowDirection, R_OUTER);
    
    return (
      <g>
        {/* Line 1: Arrow center to target (orange dashed) - where it SHOULD point */}
        <line
          x1={arrowCenter.x}
          y1={arrowCenter.y}
          x2={target.x}
          y2={target.y}
          stroke="#E65100"
          strokeWidth={3}
          strokeDasharray="8 4"
          strokeLinecap="round"
        />
        {/* Line 2: Arrow center in calculated direction (green) - where arrow IS pointing */}
        <line
          x1={arrowCenter.x}
          y1={arrowCenter.y}
          x2={actualLineEnd.x}
          y2={actualLineEnd.y}
          stroke="#4CAF50"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Small circle at arrow center (orange) */}
        <circle cx={arrowCenter.x} cy={arrowCenter.y} r={5} fill="#E65100" />
        {/* Small circle at target on blue ring (blue) */}
        <circle cx={target.x} cy={target.y} r={5} fill="#2196F3" />
      </g>
    );
  };

  // Render barrier indicator - amber equilateral triangle inside blue ring
  const renderBarrier = () => {
    const triangleSize = 10;
    // Position inside the blue ring
    const barrierRadius = R_BLUE - BLUE_STROKE/2 - 18; // Inside blue ring
    
    // Center of the triangle
    const triangleCenter = polarToCart(barrierAngle, barrierRadius);
    
    // Create equilateral triangle - 3 vertices at 120° apart, with tip pointing outward
    const tipAngleRad = toRad(barrierAngle);
    const leftAngleRad = toRad(barrierAngle + 120);
    const rightAngleRad = toRad(barrierAngle - 120);
    
    const tip = {
      x: triangleCenter.x + triangleSize * Math.cos(tipAngleRad),
      y: triangleCenter.y + triangleSize * Math.sin(tipAngleRad)
    };
    const left = {
      x: triangleCenter.x + triangleSize * Math.cos(leftAngleRad),
      y: triangleCenter.y + triangleSize * Math.sin(leftAngleRad)
    };
    const right = {
      x: triangleCenter.x + triangleSize * Math.cos(rightAngleRad),
      y: triangleCenter.y + triangleSize * Math.sin(rightAngleRad)
    };
    
    return (
      <polygon
        points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
        fill="#FFA000"
      />
    );
  };

  // Render hurdle indicators (N circle for next hurdle)
  const renderHurdles = () => {
    const hurdleRadius = R_OUTER + 20;
    const indicators = [];
    
    // Find next observation
    const nextObs = observations.find(obs => !obs.triggered);
    
    // Next hurdle (N) - green circle
    if (nextObs && !is_called) {
      const nextAngle = mapPerformanceToAngle(nextObs.hurdle_percent - 100);
      const pos = polarToCart(nextAngle, hurdleRadius);
      
      indicators.push(
        <g key="next-hurdle">
          <circle cx={pos.x} cy={pos.y} r={14} fill={colors.greenAccent} />
          <text x={pos.x} y={pos.y + 1} fill={colors.white} fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">N</text>
        </g>
      );
    }
    
    return <g>{indicators}</g>;
  };

  // Render scale markers around the outside
  const renderScaleMarkers = () => {
    const labelRadius = R_OUTER + 40;
    const markers = [
      { angle: 0, label: '0%' },
      { angle: 30, label: '+5%' },
      { angle: 90, label: '+30%' },
      { angle: 120, label: '+50%' },
      { angle: -30, label: '-5%' },
      { angle: -90, label: '-30%' },
      { angle: -120, label: '-50%' }
    ];
    
    return (
      <g>
        {markers.map((m, i) => {
          const pos = polarToCart(m.angle, labelRadius);
          return (
            <text key={i} x={pos.x} y={pos.y} fill={colors.greyMid} fontSize="11" textAnchor="middle" dominantBaseline="middle" fontFamily="Inter, Segoe UI, sans-serif">
              {m.label}
            </text>
          );
        })}
      </g>
    );
  };

  // Render 12 o'clock marker
  const render12OClockMarker = () => (
    <line
      x1={CENTER}
      y1={CENTER - R_OUTER - 5}
      x2={CENTER}
      y2={CENTER - R_OUTER - 18}
      stroke={colors.greenAccent}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );

  // Render centre info
  const renderCentreInfo = () => {
    return (
      <g>
        <text x={CENTER} y={CENTER + 115} fill={colors.navy} fontSize="11" textAnchor="middle" fontFamily="Inter, Segoe UI, sans-serif">
          {counterparty}
        </text>
        <text x={CENTER} y={CENTER + 133} fill={performance >= 0 ? colors.greenAccent : colors.barrierRed} fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="Inter, Segoe UI, sans-serif">
          {performance >= 0 ? '+' : ''}{performance.toFixed(1)}%
        </text>
        {is_called && called_date && (
          <text x={CENTER} y={CENTER + 150} fill={colors.greenAccent} fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="Inter, Segoe UI, sans-serif">
            Called: {called_date}
          </text>
        )}
      </g>
    );
  };

  // Render logo text (from SVG file)
  const renderLogoText = () => {
    // Scale and position the logo text below the main logo
    // Original SVG viewBox: 0 0 2311.2 700.75
    // Scale to fit within 512 width, centered
    const textScale = 0.20;
    const textWidth = 2311.2 * textScale; // ~462
    const textX = (VIEWBOX - textWidth) / 2;
    const textY = VIEWBOX - 45; // Position near bottom
    
    return (
      <g transform={`translate(${textX}, ${textY}) scale(${textScale})`}>
        {/* Autocalls.uk text - navy blue */}
        <path fill="#0b3763" fillRule="evenodd" d="M338.3,199.44c-9.86-30.2-19.36-59.06-28.8-88-.67-.06-1.35-.06-2-.11-9.08,29.22-19.72,57.92-28.65,88.07Zm-52-149.08c16.41,0,32.1,0,47.8-.06,4.85,0,5.62,3.31,6.86,6.82,10.07,28.39,20.34,56.68,30.41,85.07q25.47,71.7,50.79,143.51c.88,2.42,1.45,4.9,2.38,8H370.77l-17.91-51.83c-3-.21-5.89-.57-8.78-.57q-35.38-.08-70.82-.05c-9,0-9.09.05-12.13,9.19-4.75,14.25-9.5,28.5-14.35,43.16H198C226.85,211.93,256.64,131.35,286.27,50.36Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M899,207.75c-1-12.91-2.63-25.14-9.08-36.24-7.9-13.58-19.51-20.91-35.57-19.87-15,.93-25.09,9.44-30.66,22.5-3.41,8-5.11,16.88-6.09,25.56a75.7,75.7,0,0,0,5,38.51c6.92,16.46,18.85,24.46,35.52,24.36,16.47-.15,28.86-8.52,34.64-25.34C896,227.78,897,217.56,899,207.75Zm-131.22-.31c0-26.38,7.69-49.45,27.62-67.83,38.87-35.77,107.37-28.5,137.26,14.92,12.86,18.68,15.38,40.06,14.2,62-2.64,48.93-35.36,75.83-74.85,81.56-40.06,5.78-79-12.34-95.76-46.77C770.53,239.7,767.64,224.47,767.79,207.44Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M598.37,293.75H553.2c-.46-5.26-.88-10.27-1.44-16.67-2.64,1.75-4.5,2.68-5.94,4.08-20.08,18.27-43.41,22-68.71,14.55-20.8-6.19-34-24.93-35.05-48.47-.57-13.11-.31-26.22-.31-39.34-.05-25.55,0-51.15,0-76.71V120.82h47.6c.1,3.25.36,6.71.36,10.17v86.52c0,3.92.05,7.84.05,11.82.15,23.48,20.39,33.19,39.7,27.36a34.81,34.81,0,0,0,17.44-12.24,21.58,21.58,0,0,0,4.91-14.4c-.26-33.09-.11-66.23-.11-99.32V120.66h46.62C598.37,178.07,598.37,235.26,598.37,293.75Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M1641.64,125.26v37c-3.66-1.19-6.61-2.22-9.6-3.1-15.38-4.7-30.82-9.29-47.13-5.42a27.77,27.77,0,0,0-7.38,2.53c-10.12,5.83-11.2,17.45-1.65,24.16,5.21,3.67,11.66,5.78,17.81,8,8,2.79,16.41,4.49,24.41,7.33,22,7.85,32.32,23,32.06,46.36-.26,26.68-13.73,44.55-39.39,52-27.82,8.05-55.08,4.9-82-4.54a40.24,40.24,0,0,1-5.27-2.79V251.37c11.41,3.36,22.15,7.23,33.25,9.65,10.84,2.38,21.93,4,33.09,1.14,10.68-2.74,15.53-9.34,13.88-19.1-1.13-6.56-5.78-10.38-11.25-12.65-7.54-3.1-15.54-5-23.23-7.79-9.19-3.36-18.69-6.2-27.26-10.74-26.94-14.2-26.58-47-15.33-64.84,10-15.74,25.09-23.64,42.49-27.61C1593.48,113.85,1617.22,117.52,1641.64,125.26Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M652.78,120.3V80.71c15.64-2.53,30.61-5,47-7.69v46.61h46.25c.77,12,.31,23.28.46,35.78H700.84c-.41,3.56-1,6-1,8.51-.1,26.23.1,52.4-.16,78.62-.15,14.82,6.46,21.89,23.9,20.7,7.64-.51,15.18-3,23.23-4.75,1,10.33,2,20.6,3,31.8-25.4,9.09-50.33,13.32-75.32.42-13.57-7-20.95-18.9-21.21-34.13-.57-29.78-.42-59.62-.52-89.41v-11H627.54V120.3Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M1115.67,126.14c-1.7,12.08-3.36,23.9-5.16,36.54-7.49-2-14.51-4.38-21.68-5.57-17.55-2.94-34.85-2.63-49.3,9.81-16.62,14.35-20.24,33.19-15.7,53.63,4.19,18.79,16.37,31,34.64,36.81,13.94,4.44,27.78,3.35,41.4-1.55,3.67-1.29,7.18-2.94,12-4.9.67,12.33,1.29,23.9,1.86,35.46-13.17,7.64-26.9,10.63-40.89,11.82-35.46,3-65.5-7.59-86.26-37.84-36.29-52.86-7.07-126.68,55.34-140.62,23.34-5.21,46.2-3.2,68.71,4.29C1112.11,124.48,1113.5,125.21,1115.67,126.14Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M1337.28,45.71h46.15c.41,82.54,0,164.67.26,246.7-6.71,2.17-34.85,2.58-46.41.72Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M1479.86,293.65h-44.29c-2-6.82-2.74-233.74-.72-247.73h45Z"/>
        <path fill="#0b3763" fillRule="evenodd" d="M1242.19,219c-10.94,0-20.44-.93-29.68.31a39.77,39.77,0,0,0-17.6,7.75c-7,5.31-9.19,13.42-6.71,22.14,2.37,8.31,8.1,13.63,16.57,14.92,14.19,2.17,25.71-3.2,34.59-14.25a12.86,12.86,0,0,0,2.78-7.07C1242.4,235.32,1242.19,227.78,1242.19,219ZM1241,188.86c2.58-19.88-6.51-31.34-25.2-32.94-16.93-1.5-33.24,1.34-49.24,6.82-3.31,1.13-6.71,2-11,3.2v-34c-.15.2.1-.57.62-.83,30.3-14.5,61.64-19.25,94.37-9.34,19.41,5.88,30.4,19.82,35.46,38.71a84.66,84.66,0,0,1,2.53,20.39c.36,21.94.21,43.93.21,65.87,0,1.29-.06,2.64,0,3.93.15,12.39,2.47,14.5,15.79,12.85,0,7.49.31,14.82-.21,22.15-.15,2.06-2.21,4.75-4.18,5.78-10.11,5.21-20.9,7.59-32.31,6.24-10.69-1.23-18.53-6.14-21.58-17.08a42.76,42.76,0,0,0-2.06-4.65c-3.2,3-5.94,5.63-8.83,8.16-23.23,20.18-63.75,18.32-84.09-3.87-21.17-23-15.33-62.72,11.61-78.47,11-6.4,23-9.45,35.47-10.63,11-1,22.19-1.19,33.34-1.71C1234.76,189.11,1238,189,1241,188.86Z"/>
        {/* .uk text - green */}
        <path fill="#107b44" fillRule="evenodd" d="M2000.41,191.13c5.58-6.66,11.15-13.32,16.62-20,12.29-14.92,24.63-29.79,36.65-44.91,3.62-4.55,7.49-6.4,13.37-6.2,13,.47,26,.16,41.25.16-20.91,25.55-40.47,49.4-60.4,73.76,21.94,32.84,43.73,65.41,66.18,99a52.53,52.53,0,0,1-6.92,1c-12.44.11-24.93-.31-37.32.21-6.61.26-10.68-1.7-14.4-7.38-16.78-25.4-34.07-50.49-51.21-75.68-1.08-1.6-2.32-3-4.28-5.47-2.84,7.85-1.14,14.92-1.45,21.73-.31,7.54,0,15.08,0,22.61v43.47h-45.17V48.24h44.86V190.15A16.89,16.89,0,0,1,2000.41,191.13Z"/>
        <path fill="#107b44" fillRule="evenodd" d="M1913.43,293.39h-43.21c-.77-5.94-1.55-11.56-2.48-18.33-5,4-8.93,7.44-13.16,10.38-20.75,14.71-43.15,16.47-66.18,6.81-20.49-8.57-29.58-26-30-46.92-.93-40.26-.26-80.58-.21-120.9a21.9,21.9,0,0,1,.78-3.56h46c.16,2.74.47,5.27.47,7.8q.08,44.75,0,89.46c0,2.94.15,5.88,0,8.82-1.19,27.05,24.62,37.22,44.29,27.62,11.46-5.57,18.79-13.78,18.43-28.39-.83-32.42-.31-64.89-.31-97.31,0-2.53.31-5.06.46-8.15h45.07Z"/>
        {/* Green dot */}
        <path fill="#107b44" fillRule="evenodd" d="M1729.6,268.35c-.25,16.11-13,28.09-29.47,27.62-12.85-.36-28.19-10.17-27.41-29.63.62-16,12.18-26.79,29.16-26.28C1718.09,240.58,1729.86,252.56,1729.6,268.35Z"/>
      <path fill="#0b3763" class="cls-3"
        d="M2077.2,521.57a9.53,9.53,0,0,0-4.39-8.42c-2.93-2-7-3-12.09-3.18l-21.84-.61a31.69,31.69,0,0,0-5.07,4.46,26.51,26.51,0,0,0-3,4.09,12.32,12.32,0,0,0-1.53,3.78,19.54,19.54,0,0,0-.36,3.78q0,6.1,6.16,9.28t17.39,3.17a41.83,41.83,0,0,0,11.72-1.4,22.78,22.78,0,0,0,7.69-3.72,13.38,13.38,0,0,0,4.15-5.19A15.34,15.34,0,0,0,2077.2,521.57Zm-7.2-86.9q0-8.79-4.88-13.67t-13.8-4.88a19.25,19.25,0,0,0-7.93,1.52,15.87,15.87,0,0,0-5.67,4.15,17.13,17.13,0,0,0-3.36,6.1,24.06,24.06,0,0,0-1.1,7.27q0,8.29,4.88,13.12t13.55,4.82a20.31,20.31,0,0,0,8.06-1.47,15.66,15.66,0,0,0,5.67-4,17.46,17.46,0,0,0,3.42-5.92A21.45,21.45,0,0,0,2070,434.67Zm39.42-25.75q0,5.85-1.34,8.66c-.9,1.87-2,2.81-3.3,2.81H2092a17.33,17.33,0,0,1,3.84,6.65,25.7,25.7,0,0,1,1.16,7.75,42.52,42.52,0,0,1-3.17,16.9,33.59,33.59,0,0,1-9.09,12.45,40.18,40.18,0,0,1-14.28,7.69,62,62,0,0,1-18.62,2.63,38.57,38.57,0,0,1-10-1.28,25.77,25.77,0,0,1-7.32-3,17.52,17.52,0,0,0-2.62,3.78,10.19,10.19,0,0,0-1.16,4.88,6.9,6.9,0,0,0,3.11,5.8c2.08,1.5,5,2.34,8.73,2.5l26.48,1a64.32,64.32,0,0,1,16.54,2.62,35.48,35.48,0,0,1,12.21,6.35,27.42,27.42,0,0,1,7.56,9.82A31.08,31.08,0,0,1,2108,520a33.77,33.77,0,0,1-3.54,15.2,34.45,34.45,0,0,1-10.62,12.39,55,55,0,0,1-17.76,8.29,91,91,0,0,1-25,3.06,110.68,110.68,0,0,1-23.74-2.2,52.3,52.3,0,0,1-16.11-6.1,24.78,24.78,0,0,1-9.15-9.34,25.12,25.12,0,0,1-2.87-11.9,27.73,27.73,0,0,1,1-7.69,29,29,0,0,1,3-7,36.53,36.53,0,0,1,4.94-6.41,53.4,53.4,0,0,1,6.71-5.85,20.31,20.31,0,0,1-11-18.19,26.59,26.59,0,0,1,3.29-13.12,41.8,41.8,0,0,1,8.55-10.68,32.3,32.3,0,0,1-6.84-10.25q-2.57-6-2.56-14.89a41.28,41.28,0,0,1,3.36-17,36,36,0,0,1,9.33-12.69,41.31,41.31,0,0,1,14.28-7.93,58.09,58.09,0,0,1,18.31-2.75,75.85,75.85,0,0,1,9.83.61,65.71,65.71,0,0,1,8.72,1.71h34.54q2.08,0,3.36,2.68T2109.42,408.92Zm-128.3,101.3a3.3,3.3,0,0,1-.73,2.13,5.4,5.4,0,0,1-2.44,1.53,20.52,20.52,0,0,1-4.7.91,72.71,72.71,0,0,1-7.39.31,73.84,73.84,0,0,1-7.5-.31,20.41,20.41,0,0,1-4.7-.91,5.4,5.4,0,0,1-2.44-1.53,3.31,3.31,0,0,1-.74-2.13V448.09a52.68,52.68,0,0,0-1.15-12.45,24.85,24.85,0,0,0-3.36-7.75,15,15,0,0,0-5.68-5,17.65,17.65,0,0,0-8.11-1.77q-5.87,0-11.84,4.27a63.91,63.91,0,0,0-12.45,12.45v72.38a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.35a3.81,3.81,0,0,1,.61-2.14,4.44,4.44,0,0,1,2.2-1.52,17.19,17.19,0,0,1,4.09-.92,54.32,54.32,0,0,1,6.28-.3,57.34,57.34,0,0,1,6.47.3,14.46,14.46,0,0,1,4,.92,4.4,4.4,0,0,1,2,1.52,3.73,3.73,0,0,1,.61,2.14v12.57a69.29,69.29,0,0,1,18.37-14.65,41.57,41.57,0,0,1,19.47-4.88q11.1,0,18.73,3.66a32.75,32.75,0,0,1,12.33,9.95,40.34,40.34,0,0,1,6.77,14.71,85.36,85.36,0,0,1,2.08,20.26ZM1848.77,364.49q0,9.27-3.79,12.81t-14,3.54q-10.38,0-14-3.41t-3.6-12.33q0-9.27,3.73-12.88t14.09-3.6q10.26,0,13.92,3.48T1848.77,364.49Zm-2.32,145.73a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.59a3.35,3.35,0,0,1,.73-2.13,5.84,5.84,0,0,1,2.51-1.59,21,21,0,0,1,4.7-1,77.16,77.16,0,0,1,14.89,0,21.06,21.06,0,0,1,4.69,1,5.84,5.84,0,0,1,2.51,1.59,3.35,3.35,0,0,1,.73,2.13Zm-53-10.74a38.23,38.23,0,0,1-.68,8.24,8.69,8.69,0,0,1-1.77,4,9.54,9.54,0,0,1-3.23,2.08,29.54,29.54,0,0,1-5,1.58,51.17,51.17,0,0,1-6.23,1,60.9,60.9,0,0,1-6.77.37,48.59,48.59,0,0,1-15.87-2.32,26.49,26.49,0,0,1-11.11-7.14,29.64,29.64,0,0,1-6.46-12.14,63.81,63.81,0,0,1-2.08-17.34V422.1h-13.06q-2.31,0-3.54-2.87c-.81-1.91-1.22-5.11-1.22-9.58a47.84,47.84,0,0,1,.31-6,14.24,14.24,0,0,1,.91-3.85,4.54,4.54,0,0,1,1.53-2,3.72,3.72,0,0,1,2.13-.61h12.94V372.91a3.78,3.78,0,0,1,.67-2.2,5,5,0,0,1,2.44-1.64,19.11,19.11,0,0,1,4.76-1c2-.2,4.46-.31,7.39-.31s5.51.11,7.5.31a18.08,18.08,0,0,1,4.7,1,5.41,5.41,0,0,1,2.44,1.64,3.58,3.58,0,0,1,.74,2.2V397.2h23.67a3.73,3.73,0,0,1,2.14.61,4.46,4.46,0,0,1,1.52,2,14.2,14.2,0,0,1,.92,3.85,49.84,49.84,0,0,1,.31,6c0,4.47-.41,7.67-1.23,9.58s-2,2.87-3.53,2.87h-23.8v51.14q0,8.91,2.8,13.36t10,4.46a20.87,20.87,0,0,0,4.39-.43,27.46,27.46,0,0,0,3.48-1c1-.36,1.87-.69,2.57-1a4.91,4.91,0,0,1,1.89-.43,2.53,2.53,0,0,1,1.4.43,2.86,2.86,0,0,1,1,1.7,27,27,0,0,1,.67,3.48A42.78,42.78,0,0,1,1793.5,499.48Zm-84.76-20a36.66,36.66,0,0,1-3.48,16.36,32.58,32.58,0,0,1-9.82,11.83,44,44,0,0,1-15,7.14,70.57,70.57,0,0,1-18.79,2.38,71.67,71.67,0,0,1-11.66-.91,69.56,69.56,0,0,1-9.94-2.32,52.54,52.54,0,0,1-7.33-2.87,18.14,18.14,0,0,1-4.27-2.74,8.52,8.52,0,0,1-2.07-4,33.55,33.55,0,0,1-.74-8.12,50.1,50.1,0,0,1,.25-5.67,14.06,14.06,0,0,1,.73-3.42,3.22,3.22,0,0,1,1.22-1.71,3.64,3.64,0,0,1,1.83-.43,9.08,9.08,0,0,1,4,1.53c1.75,1,3.92,2.13,6.53,3.36a69.38,69.38,0,0,0,9.09,3.41,40.17,40.17,0,0,0,11.78,1.59,28.93,28.93,0,0,0,7.38-.86,18.35,18.35,0,0,0,5.62-2.44,10.43,10.43,0,0,0,3.6-4,12.46,12.46,0,0,0,1.22-5.62,9.33,9.33,0,0,0-2.26-6.28,20.1,20.1,0,0,0-6-4.58,69.18,69.18,0,0,0-8.42-3.66q-4.7-1.71-9.64-3.79a88.1,88.1,0,0,1-9.65-4.76,36.62,36.62,0,0,1-8.42-6.59,30,30,0,0,1-6-9.39,34.78,34.78,0,0,1-2.26-13.19,33.41,33.41,0,0,1,3.06-14.34,31.16,31.16,0,0,1,8.78-11.16,41.62,41.62,0,0,1,14-7.21,62.37,62.37,0,0,1,18.49-2.56,67.33,67.33,0,0,1,10,.73,73.38,73.38,0,0,1,8.72,1.83,42.65,42.65,0,0,1,6.59,2.38,22.47,22.47,0,0,1,3.85,2.2,6.21,6.21,0,0,1,1.65,1.83,8.11,8.11,0,0,1,.73,2.2c.16.85.3,1.91.42,3.17s.19,2.83.19,4.7c0,2.2-.06,4-.19,5.37a13.82,13.82,0,0,1-.61,3.3,2.87,2.87,0,0,1-1.16,1.64,3.23,3.23,0,0,1-1.7.43,8.33,8.33,0,0,1-3.42-1.28q-2.32-1.27-5.8-2.75a68.94,68.94,0,0,0-8-2.74,38.61,38.61,0,0,0-10.44-1.28,26.83,26.83,0,0,0-7.2.85,13.66,13.66,0,0,0-5,2.44,10.22,10.22,0,0,0-2.93,3.72,10.92,10.92,0,0,0-1,4.58,9.11,9.11,0,0,0,2.32,6.35,21.14,21.14,0,0,0,6.1,4.51,67.71,67.71,0,0,0,8.61,3.67c3.21,1.13,6.46,2.38,9.76,3.72a88.08,88.08,0,0,1,9.76,4.7,36.6,36.6,0,0,1,8.61,6.59,30.29,30.29,0,0,1,6.1,9.33A32.63,32.63,0,0,1,1708.74,479.46ZM1577,443.82q.38-12.93-5.19-20.32t-17.14-7.38a22.28,22.28,0,0,0-10.19,2.19,21,21,0,0,0-7.21,5.92,27.05,27.05,0,0,0-4.39,8.79,43.56,43.56,0,0,0-1.77,10.8Zm29.78,8.79q0,5.61-2.5,8.3a9,9,0,0,1-6.9,2.68h-66.27a45.26,45.26,0,0,0,1.65,12.64,24.18,24.18,0,0,0,5.25,9.64,22.87,22.87,0,0,0,9.27,6,39.84,39.84,0,0,0,13.61,2.07,76.93,76.93,0,0,0,14.16-1.15,94.34,94.34,0,0,0,10.56-2.57c3-.93,5.43-1.79,7.38-2.56a13.76,13.76,0,0,1,4.76-1.16,3.54,3.54,0,0,1,1.83.43,3.11,3.11,0,0,1,1.22,1.52,10,10,0,0,1,.67,3.11c.12,1.35.19,3,.19,5.07,0,1.79,0,3.32-.13,4.58a29,29,0,0,1-.36,3.23,7.79,7.79,0,0,1-.73,2.26,8.66,8.66,0,0,1-1.29,1.77,14.74,14.74,0,0,1-4.33,2.32,70.26,70.26,0,0,1-9,2.87,124.55,124.55,0,0,1-12.57,2.44,104.83,104.83,0,0,1-15.14,1,80.11,80.11,0,0,1-25.44-3.66,45.27,45.27,0,0,1-18.25-11.1,46.26,46.26,0,0,1-10.92-18.8q-3.6-11.36-3.6-26.61a84.65,84.65,0,0,1,3.78-26.18,54.84,54.84,0,0,1,11-19.77,47.25,47.25,0,0,1,17.52-12.39,60.36,60.36,0,0,1,23.25-4.27q13.66,0,23.37,4a42.11,42.11,0,0,1,15.93,11.17,45,45,0,0,1,9.15,16.9,73.39,73.39,0,0,1,2.93,21.24Zm-116.4-51.38c0,.4,0,.89-.07,1.46a18.8,18.8,0,0,1-.24,1.89c-.12.69-.28,1.49-.49,2.38s-.47,1.91-.79,3.05l-32.71,98.5a9.76,9.76,0,0,1-1.65,3.36,6.91,6.91,0,0,1-3.42,2,28.85,28.85,0,0,1-6.46,1q-4.1.24-10.68.24t-10.56-.31a29.27,29.27,0,0,1-6.41-1,6.91,6.91,0,0,1-3.36-2,9.52,9.52,0,0,1-1.64-3.23L1379.19,410c-.49-1.62-.88-3.09-1.16-4.39a21.56,21.56,0,0,1-.49-2.81c0-.57-.06-1.1-.06-1.58a3.5,3.5,0,0,1,.67-2.14,5,5,0,0,1,2.38-1.53,19.4,19.4,0,0,1,4.7-.85q3-.24,7.51-.24c3.33,0,6,.1,8,.3a24.91,24.91,0,0,1,4.82.86,4.54,4.54,0,0,1,2.5,1.58,9.39,9.39,0,0,1,1.22,2.5l24.78,80,.73,3,.74-3,24.41-80a6.86,6.86,0,0,1,1.15-2.5,4.93,4.93,0,0,1,2.51-1.58,23,23,0,0,1,4.57-.86q2.88-.3,7.51-.3t7.38.24a17.09,17.09,0,0,1,4.46.85,4.51,4.51,0,0,1,2.2,1.53A3.81,3.81,0,0,1,1490.38,401.23Zm-126.9,109a3.3,3.3,0,0,1-.73,2.13,5.4,5.4,0,0,1-2.44,1.53,20.52,20.52,0,0,1-4.7.91,72.71,72.71,0,0,1-7.39.31,73.84,73.84,0,0,1-7.5-.31,20.41,20.41,0,0,1-4.7-.91,5.4,5.4,0,0,1-2.44-1.53,3.31,3.31,0,0,1-.74-2.13V448.09a52.68,52.68,0,0,0-1.15-12.45,24.85,24.85,0,0,0-3.36-7.75,15,15,0,0,0-5.68-5,17.65,17.65,0,0,0-8.11-1.77q-5.86,0-11.84,4.27a63.91,63.91,0,0,0-12.45,12.45v72.38a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.35a3.81,3.81,0,0,1,.61-2.14,4.44,4.44,0,0,1,2.2-1.52,17.19,17.19,0,0,1,4.09-.92,54.32,54.32,0,0,1,6.28-.3,57.34,57.34,0,0,1,6.47.3,14.46,14.46,0,0,1,4,.92,4.4,4.4,0,0,1,2,1.52,3.73,3.73,0,0,1,.61,2.14v12.57a69.29,69.29,0,0,1,18.37-14.65,41.57,41.57,0,0,1,19.47-4.88q11.1,0,18.73,3.66a32.75,32.75,0,0,1,12.33,9.95,40.34,40.34,0,0,1,6.77,14.71,85.36,85.36,0,0,1,2.08,20.26ZM1226.94,510a3.38,3.38,0,0,1-.79,2.2,5.6,5.6,0,0,1-2.62,1.59,25.92,25.92,0,0,1-4.88,1,82.08,82.08,0,0,1-15.57,0,26,26,0,0,1-4.94-1,5.6,5.6,0,0,1-2.62-1.59,3.39,3.39,0,0,1-.8-2.2V360.83a3.39,3.39,0,0,1,.8-2.2,5.62,5.62,0,0,1,2.68-1.59,27.4,27.4,0,0,1,4.94-1,65.21,65.21,0,0,1,7.69-.37,66.57,66.57,0,0,1,7.82.37,25.92,25.92,0,0,1,4.88,1,5.6,5.6,0,0,1,2.62,1.59,3.38,3.38,0,0,1,.79,2.2Zm-120.5.25a3.3,3.3,0,0,1-.73,2.13,5.4,5.4,0,0,1-2.44,1.53,20.52,20.52,0,0,1-4.7.91,72.71,72.71,0,0,1-7.39.31,73.84,73.84,0,0,1-7.5-.31,20.41,20.41,0,0,1-4.7-.91,5.4,5.4,0,0,1-2.44-1.53,3.31,3.31,0,0,1-.74-2.13V448.09a52.68,52.68,0,0,0-1.15-12.45,24.85,24.85,0,0,0-3.36-7.75,15,15,0,0,0-5.68-5,17.65,17.65,0,0,0-8.11-1.77q-5.87,0-11.84,4.27a63.91,63.91,0,0,0-12.45,12.45v72.38a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.35a3.81,3.81,0,0,1,.61-2.14,4.44,4.44,0,0,1,2.2-1.52,17.19,17.19,0,0,1,4.09-.92,54.32,54.32,0,0,1,6.28-.3,57.34,57.34,0,0,1,6.47.3,14.46,14.46,0,0,1,4,.92,4.4,4.4,0,0,1,2,1.52,3.73,3.73,0,0,1,.61,2.14v12.57a69.29,69.29,0,0,1,18.37-14.65,41.57,41.57,0,0,1,19.47-4.88q11.1,0,18.73,3.66a32.75,32.75,0,0,1,12.33,9.95,40.34,40.34,0,0,1,6.77,14.71,85.36,85.36,0,0,1,2.08,20.26ZM946.53,455.91a80.18,80.18,0,0,0-1.28-14.83,34.81,34.81,0,0,0-4.33-11.78,21.65,21.65,0,0,0-8.12-7.81q-5.07-2.81-12.75-2.81a27,27,0,0,0-12,2.5,21.58,21.58,0,0,0-8.42,7.32,35.25,35.25,0,0,0-4.94,11.6,65.5,65.5,0,0,0-1.65,15.44,76,76,0,0,0,1.35,14.83,36.53,36.53,0,0,0,4.33,11.78,20.69,20.69,0,0,0,8.11,7.75,26.66,26.66,0,0,0,12.7,2.74,27.23,27.23,0,0,0,12.08-2.5,21.61,21.61,0,0,0,8.42-7.26,33.24,33.24,0,0,0,4.88-11.54A67.78,67.78,0,0,0,946.53,455.91Zm31.61-1.23a83.23,83.23,0,0,1-3.66,25.39,53.43,53.43,0,0,1-11.11,19.77,49.24,49.24,0,0,1-18.67,12.82q-11.24,4.51-26.24,4.51-14.52,0-25.27-4a45.37,45.37,0,0,1-17.81-11.72,48.17,48.17,0,0,1-10.5-18.92,88,88,0,0,1-3.42-25.63,82.61,82.61,0,0,1,3.72-25.45,53.75,53.75,0,0,1,11.17-19.77A49.91,49.91,0,0,1,895,398.91q11.17-4.52,26.18-4.52,14.65,0,25.39,4A44.41,44.41,0,0,1,964.29,410a48.51,48.51,0,0,1,10.43,18.92A88.48,88.48,0,0,1,978.14,454.68ZM839.69,364.49q0,9.27-3.79,12.81t-14,3.54q-10.38,0-14-3.41t-3.6-12.33q0-9.27,3.73-12.88t14.09-3.6q10.26,0,13.92,3.48T839.69,364.49Zm-2.32,145.73a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.59a3.35,3.35,0,0,1,.73-2.13,5.84,5.84,0,0,1,2.51-1.59,21,21,0,0,1,4.7-1,77.16,77.16,0,0,1,14.89,0,21.06,21.06,0,0,1,4.69,1,5.84,5.84,0,0,1,2.51,1.59,3.35,3.35,0,0,1,.73,2.13Zm-53.83-30.76a36.66,36.66,0,0,1-3.48,16.36,32.58,32.58,0,0,1-9.82,11.83,44,44,0,0,1-15,7.14,70.57,70.57,0,0,1-18.79,2.38,71.67,71.67,0,0,1-11.66-.91,69.56,69.56,0,0,1-9.94-2.32,52.54,52.54,0,0,1-7.33-2.87,18.14,18.14,0,0,1-4.27-2.74,8.52,8.52,0,0,1-2.07-4,33.55,33.55,0,0,1-.74-8.12,50.1,50.1,0,0,1,.25-5.67,14.06,14.06,0,0,1,.73-3.42,3.22,3.22,0,0,1,1.22-1.71,3.64,3.64,0,0,1,1.83-.43,9.08,9.08,0,0,1,4,1.53c1.75,1,3.92,2.13,6.53,3.36a69.38,69.38,0,0,0,9.09,3.41,40.17,40.17,0,0,0,11.78,1.59,28.93,28.93,0,0,0,7.38-.86,18.35,18.35,0,0,0,5.62-2.44,10.43,10.43,0,0,0,3.6-4,12.46,12.46,0,0,0,1.22-5.62,9.33,9.33,0,0,0-2.26-6.28,20.1,20.1,0,0,0-6-4.58,69.18,69.18,0,0,0-8.42-3.66q-4.69-1.71-9.64-3.79a88.1,88.1,0,0,1-9.65-4.76,36.62,36.62,0,0,1-8.42-6.59,30,30,0,0,1-6-9.39A34.78,34.78,0,0,1,701,429.66a33.41,33.41,0,0,1,3.06-14.34,31.16,31.16,0,0,1,8.78-11.16,41.62,41.62,0,0,1,14-7.21,62.37,62.37,0,0,1,18.49-2.56,67.33,67.33,0,0,1,9.95.73A73.38,73.38,0,0,1,764,397a42.65,42.65,0,0,1,6.59,2.38,22.47,22.47,0,0,1,3.85,2.2,6.21,6.21,0,0,1,1.65,1.83,8.11,8.11,0,0,1,.73,2.2c.16.85.3,1.91.42,3.17s.19,2.83.19,4.7c0,2.2-.06,4-.19,5.37a13.82,13.82,0,0,1-.61,3.3,2.87,2.87,0,0,1-1.16,1.64,3.23,3.23,0,0,1-1.7.43,8.33,8.33,0,0,1-3.42-1.28q-2.33-1.27-5.8-2.75a68.94,68.94,0,0,0-8-2.74,38.61,38.61,0,0,0-10.44-1.28,26.83,26.83,0,0,0-7.2.85,13.66,13.66,0,0,0-5,2.44,10.22,10.22,0,0,0-2.93,3.72,10.92,10.92,0,0,0-1,4.58,9.11,9.11,0,0,0,2.32,6.35,21.14,21.14,0,0,0,6.1,4.51,67.71,67.71,0,0,0,8.61,3.67c3.21,1.13,6.46,2.38,9.76,3.72a88.08,88.08,0,0,1,9.76,4.7,36.6,36.6,0,0,1,8.61,6.59,30.29,30.29,0,0,1,6.1,9.33A32.63,32.63,0,0,1,783.54,479.46Zm-105-115q0,9.27-3.79,12.81t-14,3.54q-10.38,0-14-3.41t-3.6-12.33q0-9.27,3.73-12.88t14.09-3.6q10.26,0,13.92,3.48T678.53,364.49Zm-2.32,145.73a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.59a3.35,3.35,0,0,1,.73-2.13,5.84,5.84,0,0,1,2.51-1.59,21,21,0,0,1,4.7-1,77.16,77.16,0,0,1,14.89,0,21.06,21.06,0,0,1,4.69,1,5.84,5.84,0,0,1,2.51,1.59,3.35,3.35,0,0,1,.73,2.13Zm-53-17.33c0,2.11-.06,3.88-.19,5.31a31.77,31.77,0,0,1-.48,3.6,11.23,11.23,0,0,1-.74,2.38,8.72,8.72,0,0,1-1.89,2.32,27.11,27.11,0,0,1-5,3.41,48.21,48.21,0,0,1-8.06,3.6,64.74,64.74,0,0,1-9.82,2.57,60.38,60.38,0,0,1-10.93,1,59.36,59.36,0,0,1-22.27-3.9,41.78,41.78,0,0,1-16.29-11.54A50.63,50.63,0,0,1,537.58,483a86,86,0,0,1-3.36-25.14q0-16.37,4.09-28.26a54.15,54.15,0,0,1,11.41-19.71,45.45,45.45,0,0,1,17.33-11.59,61.54,61.54,0,0,1,22-3.79,53.34,53.34,0,0,1,9.58.86,54.76,54.76,0,0,1,8.79,2.32,46.1,46.1,0,0,1,7.32,3.29,21.94,21.94,0,0,1,4.58,3.18,12.12,12.12,0,0,1,1.89,2.25,7.82,7.82,0,0,1,.86,2.38,34,34,0,0,1,.49,3.6q.18,2.14.18,5.19,0,7.08-1.22,9.95c-.82,1.91-1.87,2.87-3.18,2.87a7.52,7.52,0,0,1-4.39-1.71q-2.32-1.71-5.49-3.79a41.37,41.37,0,0,0-7.57-3.78,29,29,0,0,0-10.5-1.71q-12,0-18.3,9.22t-6.35,27a67.62,67.62,0,0,0,1.59,15.5,32.92,32.92,0,0,0,4.7,11.23,19.68,19.68,0,0,0,7.81,6.77,24.86,24.86,0,0,0,10.92,2.26,28.53,28.53,0,0,0,10.92-1.89,44,44,0,0,0,8-4.21q3.42-2.32,5.74-4.21a6.76,6.76,0,0,1,3.9-1.89,2.75,2.75,0,0,1,1.83.61,4.25,4.25,0,0,1,1.16,2.25,26.92,26.92,0,0,1,.67,4.22Q623.2,488.85,623.2,492.89ZM485.72,443.82q.38-12.93-5.19-20.32t-17.14-7.38a22.28,22.28,0,0,0-10.19,2.19,21,21,0,0,0-7.21,5.92A27.05,27.05,0,0,0,441.6,433a43.56,43.56,0,0,0-1.77,10.8Zm29.78,8.79q0,5.61-2.5,8.3a9,9,0,0,1-6.9,2.68H439.83a45.26,45.26,0,0,0,1.65,12.64,24.18,24.18,0,0,0,5.25,9.64,22.87,22.87,0,0,0,9.27,6A39.84,39.84,0,0,0,469.61,494a76.93,76.93,0,0,0,14.16-1.15,94.34,94.34,0,0,0,10.56-2.57c3-.93,5.43-1.79,7.38-2.56a13.76,13.76,0,0,1,4.76-1.16,3.54,3.54,0,0,1,1.83.43,3.11,3.11,0,0,1,1.22,1.52,10,10,0,0,1,.67,3.11c.12,1.35.19,3,.19,5.07,0,1.79,0,3.32-.13,4.58a29,29,0,0,1-.36,3.23,7.79,7.79,0,0,1-.73,2.26,8.66,8.66,0,0,1-1.29,1.77,14.74,14.74,0,0,1-4.33,2.32,70.26,70.26,0,0,1-9,2.87,124.55,124.55,0,0,1-12.57,2.44,104.83,104.83,0,0,1-15.14,1,80.11,80.11,0,0,1-25.44-3.66,45.27,45.27,0,0,1-18.25-11.1,46.26,46.26,0,0,1-10.92-18.8q-3.6-11.36-3.6-26.61a84.65,84.65,0,0,1,3.78-26.18,54.84,54.84,0,0,1,11-19.77,47.25,47.25,0,0,1,17.52-12.39,60.36,60.36,0,0,1,23.25-4.27q13.67,0,23.37,4a42.11,42.11,0,0,1,15.93,11.17,45,45,0,0,1,9.15,16.9,73.39,73.39,0,0,1,2.93,21.24ZM398.83,411.48q0,4.39-.25,7.2a21.53,21.53,0,0,1-.73,4.39,4.27,4.27,0,0,1-1.28,2.2,3.19,3.19,0,0,1-2,.61,6.57,6.57,0,0,1-2.2-.43c-.82-.28-1.73-.59-2.75-.91s-2.13-.63-3.35-.92a18.07,18.07,0,0,0-4-.42,13.61,13.61,0,0,0-5.13,1,21.41,21.41,0,0,0-5.31,3.24,38.65,38.65,0,0,0-5.73,5.86,94.28,94.28,0,0,0-6.41,9v67.86a3.35,3.35,0,0,1-.73,2.13,5.45,5.45,0,0,1-2.51,1.53,21.36,21.36,0,0,1-4.69.91,89.56,89.56,0,0,1-14.89,0,21.34,21.34,0,0,1-4.7-.91,5.45,5.45,0,0,1-2.51-1.53,3.35,3.35,0,0,1-.73-2.13V401.35a3.81,3.81,0,0,1,.61-2.14,4.44,4.44,0,0,1,2.2-1.52,17.19,17.19,0,0,1,4.09-.92,54.32,54.32,0,0,1,6.28-.3,57.34,57.34,0,0,1,6.47.3,14.46,14.46,0,0,1,4,.92,4.4,4.4,0,0,1,2,1.52,3.73,3.73,0,0,1,.61,2.14V414.9a86.81,86.81,0,0,1,8.06-10.07,45.34,45.34,0,0,1,7.2-6.29,22.87,22.87,0,0,1,6.83-3.23,26.37,26.37,0,0,1,6.84-.92q1.59,0,3.42.18a36.12,36.12,0,0,1,3.78.61,27.07,27.07,0,0,1,3.42,1,6.72,6.72,0,0,1,2.13,1.16,3.82,3.82,0,0,1,1,1.34,10.62,10.62,0,0,1,.55,2,31.74,31.74,0,0,1,.37,3.84Q398.83,407.09,398.83,411.48Zm-126.61-4.76q0-8.3-2.93-13.67a20.27,20.27,0,0,0-7.2-7.93,23.92,23.92,0,0,0-9-3.24,68.32,68.32,0,0,0-9.71-.67H229.74v53.58h14.4A34.93,34.93,0,0,0,257,432.72a22,22,0,0,0,8.48-5.8,25.05,25.05,0,0,0,5-8.91A35.87,35.87,0,0,0,272.22,406.72Zm33.56-2.32A62.37,62.37,0,0,1,301.63,428a45.52,45.52,0,0,1-12.08,17.27,53.53,53.53,0,0,1-19.47,10.68q-11.54,3.66-27.16,3.66H229.74V510a3.38,3.38,0,0,1-.79,2.2,5.58,5.58,0,0,1-2.63,1.59,25.76,25.76,0,0,1-4.88,1,82,82,0,0,1-15.56,0,26,26,0,0,1-4.94-1,5.13,5.13,0,0,1-2.56-1.59,3.56,3.56,0,0,1-.74-2.2V367.91q0-5.75,3-8.61a10.93,10.93,0,0,1,7.88-2.87h37.22c3.74,0,7.3.15,10.68.43a114.83,114.83,0,0,1,12.14,1.83,54.06,54.06,0,0,1,14.35,5.19,42.4,42.4,0,0,1,12.38,9.58A39.83,39.83,0,0,1,303.09,387,52.86,52.86,0,0,1,305.78,404.4Z" />

      </g>
    );
  };



  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX} 800`}
      width={size}
      height={size * 1.17}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${plan_name} - Dynamic Logo showing ${performance.toFixed(1)}% performance`}
    >
      {/* Gradient definitions */}
      <defs>
        {/* Yellow → dark yellow → dark blue gradient for final observation arrow */}
        <linearGradient id="finalObsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFEB3B" />   {/* Bright yellow (top) */}
          <stop offset="50%" stopColor="#F9A825" />  {/* Dark yellow */}
          <stop offset="100%" stopColor="#0D47A1" /> {/* Dark blue (bottom) */}
        </linearGradient>
      </defs>
      
      {/* Background */}
      <rect width={VIEWBOX} height="800" fill={colors.white} />
      
      {/* Outer GREEN ring (years) with trigger arrows - rotates */}
      {renderOuterRing()}
      
      {/* Current date line at 12 o'clock (debug mode only) */}
      {debug && renderCurrentDateLine()}
      
      {/* 4 static radial marks at diagonal positions */}
      {renderRadialMarks()}
      
      {/* Navy BLUE ring - rotates */}
      {renderBlueRing()}
      
      {/* Level indicator arrows on blue ring (Initial Strike & Final Hurdle) */}
      {renderLevelArrows()}
      
      {/* Barrier indicator - fixed */}
      {renderBarrier()}
      
      {/* The "A" pointer - rotates with market performance */}
      {renderPointerA()}
      
      {/* Bottom green arrow */}
      {renderBottomArrow()}
      
      {/* Debug lines for bottom arrow (only in debug mode) */}
      {renderBottomArrowDebugLines()}
      
      {/* Centre info */}
      {renderCentreInfo()}
      
      {/* Logo text */}
      {renderLogoText()}
    </svg>
  );
};

export default DynamicLogo;
