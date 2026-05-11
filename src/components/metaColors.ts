/** Hex (#rrggbb) zu rgba mit gegebenem Alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Dezenter Tönungs-Hintergrund für Meta-Header. */
export function metaSoftBg(hex: string): string {
  return hexToRgba(hex, 0.14)
}
