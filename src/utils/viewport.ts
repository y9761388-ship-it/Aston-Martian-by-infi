export type OrientationVariant = 'mobile' | 'desktop';

export interface DeviceViewportSpec {
  variant: OrientationVariant;
  deviceClass: 'mobile' | 'vertical-tablet' | 'horizontal-tablet' | 'desktop';
  zoom: number;
  width: number;
  height: number;
}

/**
 * Resolves asset orientation and an equal, optimized zoom factor per device class
 * so Assets 1, 1.1, 2, 2.1, and 3 share the exact same scale with zero jump.
 */
export function getDeviceViewportSpec(width: number, height: number): DeviceViewportSpec {
  const safeW = Math.max(width, 1);
  const safeH = Math.max(height, 1);
  const isPortrait = safeH > safeW;
  const aspect = safeW / safeH;

  if (isPortrait) {
    const isVerticalTablet = safeW >= 600;
    return {
      variant: 'mobile',
      deviceClass: isVerticalTablet ? 'vertical-tablet' : 'mobile',
      // Equal optimized zoom across 1, 1.1, 2, 2.1, 3 for vertical tablet
      zoom: isVerticalTablet ? 1.1 : 1.0,
      width: safeW,
      height: safeH,
    };
  }

  const isHorizontalTablet = safeW <= 1366 && aspect < 1.65;
  return {
    variant: 'desktop',
    deviceClass: isHorizontalTablet ? 'horizontal-tablet' : 'desktop',
    // Equal optimized zoom across 1, 1.1, 2, 2.1, 3 for horizontal tablet & desktop
    zoom: isHorizontalTablet ? 1.08 : 1.02,
    width: safeW,
    height: safeH,
  };
}
