import { Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Base dimensions: iPhone SE / small Android (375 x 667)
const BASE_W = 375;
const BASE_H = 667;

/** Linear scale based on screen width */
function s(size: number): number {
  return (W / BASE_W) * size;
}

/**
 * Moderate scale — scales less aggressively than s().
 * Default factor 0.5 means halfway between no-scale and full-scale.
 * Good for font sizes and spacing so extremes aren't too dramatic.
 *
 * Examples at factor=0.5:
 *   320px screen: ms(16) ≈ 15
 *   375px screen: ms(16) = 16  (unchanged)
 *   414px screen: ms(16) ≈ 17
 *   430px screen: ms(16) ≈ 17
 */
export function ms(size: number, factor = 0.5): number {
  return Math.round(size + (s(size) - size) * factor);
}

/** Vertical scale based on screen height */
export function vs(size: number): number {
  return Math.round((H / BASE_H) * size);
}

export const SCREEN_WIDTH = W;
export const SCREEN_HEIGHT = H;
export const IS_SMALL_SCREEN = W < 375;
