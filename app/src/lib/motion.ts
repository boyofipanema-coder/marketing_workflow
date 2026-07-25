/**
 * Motion primitives — Apple's fluid-interface physics, framework-agnostic.
 *
 * The whole app should feel like it obeys real physics: motion starts from the
 * current on-screen value, inherits the user's velocity, projects momentum
 * forward, and can be grabbed and reversed at any instant. Springs are how we
 * get there — they're inherently interruptible and velocity-aware.
 *
 * These constants come straight from Apple's "Designing Fluid Interfaces"
 * (WWDC 2018). Apple parameterizes springs with two designer-friendly values:
 *   - response: how quickly it reaches the target, in seconds (NOT a duration)
 *   - damping:  overshoot. 1.0 = critically damped (no bounce); <1 bounces.
 *
 * If/when a spring library (Motion / Framer Motion) is added, feed SPRING.*
 * straight in. Until then, CSS_EASE + the durations in globals.css cover most
 * non-gesture transitions.
 */

/** Apple's shipped spring values, keyed by interaction. */
export const SPRING = {
  /** Default UI — graceful, non-distracting, no overshoot. */
  default: { response: 0.4, damping: 1.0 },
  /** Move / reposition (e.g. picture-in-picture). */
  move: { response: 0.4, damping: 1.0 },
  /** Rotation — a little bounce reads as physical. */
  rotate: { response: 0.4, damping: 0.8 },
  /** Drawer / sheet / side panel — momentum-driven, slight overshoot. */
  sheet: { response: 0.3, damping: 0.8 },
  /** Snappy control feedback (toggles, small pops). */
  snappy: { response: 0.25, damping: 0.9 },
} as const;

export type SpringKey = keyof typeof SPRING;

/**
 * Framer Motion / Motion map their spring API to `bounce` + `duration`, which
 * corresponds closely to Apple's damping + response. Convert here so callers
 * stay in Apple's vocabulary.
 *   damping 1.0 → bounce 0 ;  damping 0.8 → bounce ~0.2
 */
export function toMotionSpring(key: SpringKey) {
  const { response, damping } = SPRING[key];
  return {
    type: "spring" as const,
    bounce: Math.max(0, Math.min(1, 1 - damping)),
    duration: response,
  };
}

/** CSS timing functions — mirror the tokens in globals.css / tailwind. */
export const CSS_EASE = {
  out: "cubic-bezier(0.32, 0.72, 0, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const DURATION = { fast: 140, base: 240, slow: 400 } as const;

/**
 * Momentum projection — where a flick would land, à la scroll deceleration.
 * Use this (not the nearest snap point from the release position) so a flick
 * feels like it *throws* the element. From Apple's sample code.
 *
 *   const landing = current + project(releaseVelocity);
 *   const target  = nearestSnapPoint(landing);
 *
 * @param initialVelocity px/s at release
 * @param decelerationRate 0.998 ≈ normal scroll feel; 0.99 snappier
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Rubber-banding — progressive resistance past a boundary instead of a hard
 * stop. A hard stop reads as "frozen"; resistance reads as "responsive, but
 * there's nothing more here."
 *
 * @param overshoot  how far past the bound the pointer is (px)
 * @param dimension  the size of the draggable dimension (px)
 * @param constant   0.55 is Apple's default
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Normalize a gesture velocity into the relative initial velocity some spring
 * APIs expect: gestureVelocity / (target − current). Framer Motion takes
 * absolute px/s directly, so you usually don't need this — but it's here for
 * APIs that want it.
 */
export function relativeVelocity(gestureVelocity: number, current: number, target: number): number {
  const distance = target - current;
  return distance === 0 ? 0 : gestureVelocity / distance;
}
