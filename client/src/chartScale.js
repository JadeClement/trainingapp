import { hrZoneBands } from './streamUtils.js';

// Shared by SeriesChart, HrZoneChart, and the live values that ride the
// workout-detail scrub line — keep viewBox and y-mapping in one place so
// a label at (index, value) lands on the same pixel as the trace.
export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 130;
export const CHART_PADDING = 10;

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function chartYInDomain(value, domainMin, domainMax) {
  const span = domainMax - domainMin || 1;
  return (
    CHART_HEIGHT -
    CHART_PADDING -
    ((clamp(value, domainMin, domainMax) - domainMin) / span) * (CHART_HEIGHT - CHART_PADDING * 2)
  );
}

export function chartYPctInDomain(value, domainMin, domainMax) {
  return (chartYInDomain(value, domainMin, domainMax) / CHART_HEIGHT) * 100;
}

export function seriesDomain(values) {
  const present = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (present.length === 0) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  return { min, max };
}

// Pace charts invert so faster (lower) sits higher; same mapping SeriesChart uses.
export function seriesValueYPct(values, value, invert = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const domain = seriesDomain(values);
  if (!domain) return null;
  const span = domain.max - domain.min || 1;
  const t = (clamp(value, domain.min, domain.max) - domain.min) / span;
  const flipped = invert ? 1 - t : t;
  const y = CHART_HEIGHT - CHART_PADDING - flipped * (CHART_HEIGHT - CHART_PADDING * 2);
  return (y / CHART_HEIGHT) * 100;
}

export function hrChartDomain(values, maxHr) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;
  const bands = hrZoneBands(maxHr);
  return {
    min: bands.length ? bands[0].from : Math.min(...present) - 5,
    max: bands.length ? bands[bands.length - 1].to : Math.max(...present) + 5,
  };
}

export function hrValueYPct(values, value, maxHr) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const domain = hrChartDomain(values, maxHr);
  if (!domain) return null;
  return chartYPctInDomain(value, domain.min, domain.max);
}

export function laneValueYPct(lane, value) {
  if (lane.maxHr) return hrValueYPct(lane.values, value, lane.maxHr);
  return seriesValueYPct(lane.values, value, lane.invert);
}
