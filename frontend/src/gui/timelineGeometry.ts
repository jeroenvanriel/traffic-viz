export const TIMELINE_VIEWBOX_WIDTH = 760;
export const TIMELINE_VIEWBOX_HEIGHT = 60;
export const TIMELINE_PADDING_X = 8;
export const TIMELINE_BASELINE_Y = 48;
export const TIMELINE_INTERACTION_SPLIT_Y = 38;

export function clampStep(step: number): number {
  return Math.max(0, Math.round(step));
}

export function toSvgXFromClientX(clientX: number, svg: SVGSVGElement): number {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = 0;

  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return 0;
  }

  return point.matrixTransform(ctm.inverse()).x;
}

export function toStepFromSvgX(svgX: number, timelineMaxStep: number): number {
  const trackWidth = TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X * 2;
  const x = Math.min(Math.max(svgX - TIMELINE_PADDING_X, 0), trackWidth);
  const ratio = trackWidth > 0 ? x / trackWidth : 0;
  return clampStep(ratio * timelineMaxStep);
}

export function toXFromStep(step: number, timelineMaxStep: number): number {
  const span = Math.max(1, timelineMaxStep);
  const ratio = Math.min(Math.max(step / span, 0), 1);
  return TIMELINE_PADDING_X + ratio * (TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X * 2);
}