const CAMERA_X = -4.30;
const CAMERA_Y = 2.00;
const CAMERA_Z = -0.58;
const PITCH = 0.13;
const COS_PITCH = Math.cos(PITCH);
const SIN_PITCH = Math.sin(PITCH);

// World X runs downrange, Y is up, and Z runs across the tee.
export function createTeeView(width, height) {
  const focalLength = Math.min(width * 1.25, height * 0.92);
  const centerX = width / 2;
  const centerY = height * 0.49;

  function point(x, y, z) {
    const forward = x - CAMERA_X;
    const rise = y - CAMERA_Y;
    const depth = forward * COS_PITCH - rise * SIN_PITCH;
    const up = rise * COS_PITCH + forward * SIN_PITCH;
    const scale = focalLength / depth;
    return {
      x: centerX + (z - CAMERA_Z) * scale,
      y: centerY - up * scale,
      scale,
    };
  }

  return { point, horizon: centerY - focalLength * Math.tan(PITCH) };
}
