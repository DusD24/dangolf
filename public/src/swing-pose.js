import { STEP, SWING_PASS_ANGLE, TEE_X } from './practice.js';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = value => value * value * (3 - 2 * value);
const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b, scale = 1) => a.map((value, i) => value + b[i] * scale);
const blend = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
const unit = vector => {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
};
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const world = ([x, y, z]) => ({ x, y, z });

function frame(hip, spine, turns, hands, shaft, leadReach, heel = 0) {
  return { hip, spine, turns, hands, shaft, leadReach: [leadReach], heel: [heel] };
}

// Turns are pelvis, shoulders and gaze, in radians. Shaft points from hands to head.
const address = frame(
  [-.08, .78, -.98], [.035, .46, .25], [0, .04, 0],
  [.10, .70, -.78], [-.03, -.67, .74], .595,
);
const takeaway = frame(
  [-.12, .78, -.98], [-.02, .46, .25], [-.14, -.42, -.04],
  [-.42, .73, -.74], [-.97, -.13, .20], .622,
);
const halfway = frame(
  [-.17, .79, -.99], [-.085, .47, .25], [-.29, -.89, -.10],
  [-.61, 1.11, -.88], [-.55, .80, -.26], .633,
);
const top = frame(
  [-.18, .80, -1.01], [-.06, .47, .25], [-.48, -1.28, -.14],
  [-.40, 1.64, -1.06], [.98, .16, -.10], .64,
);
const delivery = frame(
  [.035, .76, -.99], [-.12, .45, .24], [.43, -.36, -.06],
  [-.38, .99, -.66], [-.72, .56, -.40], .62, .025,
);
const impact = frame(
  [.14, .79, -1], [-.11, .44, .25], [.75, .24, 0],
  [.21, .62, -.69], [-.12, -.57, .81], .64, .063,
);
const extension = frame(
  [.24, .84, -.99], [-.06, .46, .20], [1.05, .77, .30],
  [.34, .81, -.51], [.95, -.14, .27], .625, .12,
);
const wrap = frame(
  [.27, .87, -.99], [.02, .46, .13], [1.25, 1.41, .84],
  [.56, 1.30, -.95], [.74, .57, -.34], .56, .18,
);
const finish = frame(
  [.29, .88, -.94], [.04, .47, .09], [1.34, 1.86, 1.27],
  [.37, 1.61, -1.10], [.82, -.15, .55], .44, .22,
);

const backswing = [[0, address], [.27, takeaway], [.66, halfway], [1, top]];
const addressTip = [TEE_X - .12, .056, -.085];

function blendFrame(a, b, t) {
  return Object.fromEntries(Object.keys(a).map(key => [key, blend(a[key], b[key], t)]));
}

function slope(before, after) {
  return before * after > 0 ? 2 * before * after / (before + after) : 0;
}

// Interpolate with continuous velocity. A joint coming to an extremum eases into it.
function sample(track, t) {
  const end = track.findIndex(([time], i) => i > 0 && t <= time);
  if (end < 0) return track.at(-1)[1];
  const [from, a] = track[end - 1];
  const [to, b] = track[end];
  const [prevTime, previous] = track[end - 2] ?? track[end - 1];
  const [nextTime, next] = track[end + 1] ?? track[end];
  const span = to - from;
  const u = (t - from) / span;
  const weight = smooth(u);
  return Object.fromEntries(Object.keys(a).map(key => [key, a[key].map((value, i) => {
    const change = (b[key][i] - value) / span;
    const before = from === prevTime ? 0 : (value - previous[key][i]) / (from - prevTime);
    const after = to === nextTime ? 0 : (next[key][i] - b[key][i]) / (nextTime - to);
    const tangentIn = slope(before, change) * span;
    const tangentOut = slope(change, after) * span;
    return mix(value, b[key][i], weight) + u * (1 - u) * ((1 - u) * tangentIn - u * tangentOut);
  })]));
}

function clubSwing(practice) {
  const { angle, startAngle, charge, phase } = practice;
  const loaded = sample(backswing, charge);
  const setupWeight = 1 - smooth(clamp(charge / .27));
  const setup = { tip: addressTip, weight: setupWeight, direction: address.shaft };
  if (phase === 'ready' || phase === 'drawing') {
    return { pose: loaded, setup };
  }

  // The snap accelerates contact. The golfer then turns to a balanced finish
  // on their own clock, including when the staff misses the ball.
  const through = practice.clubPassedAt === null
    ? .60 * clamp((angle - startAngle) / (SWING_PASS_ANGLE - startAngle))
    : .60 + .40 * clamp((practice.elapsed - practice.clubPassedAt + STEP / 2) / (.36 + .07 * charge)) *
      (.60 + .40 * charge);
  const size = .46 + .54 * charge;
  const track = [
    [0, loaded], [.32, blendFrame(address, delivery, size)], [.60, impact],
    [.75, extension], [.88, wrap], [1, finish],
  ];
  const { x, y, z } = practice.club;
  // Match the simulated head through the hitting zone, then ease into the follow-through.
  const entering = smooth(clamp((angle + .46) / .43));
  const leaving = 1 - smooth(clamp((angle - .24) / .45));
  // A wild return has no ball contact to pin the visual clubhead to. Let the
  // hand path carry more of the animation as the simulated head veers away.
  const miss = smooth(clamp((Math.abs(practice.steer) - .42) / .50));
  const struck = practice.impact?.at === practice.elapsed;
  const contactWeight = struck ? 1 : entering * leaving * (1 - .90 * miss);
  return {
    pose: sample(track, through),
    setup: { ...setup, weight: setupWeight * (1 - smooth(clamp(through / .32))) },
    contact: { tip: [x, y, z], weight: contactWeight },
  };
}

function putterSwing(practice) {
  const { phase, elapsed, charge } = practice;
  const back = phase === 'drawing' ? -1 : 0;
  const through = phase === 'result' ? Math.sin(Math.PI * clamp(elapsed / .44)) : 0;
  const travel = charge * (back * .19 + through * .27);
  const pose = frame(address.hip, address.spine, [0, .04 + travel * 1.3, through * .14],
    address.hands, [-.06 + travel * .5, -.78, .62], .53);
  return {
    pose,
    setup: { tip: [addressTip[0] + travel, .054 + Math.abs(travel) * .10, 0], weight: 1, direction: pose.shaft },
  };
}

const leadHand = .034;
const trailHand = .047;
const upperArm = .31;
const leadForearm = .35;
const trailForearm = .34;

function shoulderSocket(chest, turn, side) {
  const tilt = .09 * Math.sin(turn) * (1 - .78 * smooth(clamp((turn - 1.05) / .68)));
  return add(add(chest, [0, .04, 0]), [Math.cos(turn) * .21, tilt, -Math.sin(turn) * .21], side);
}

function arm(shoulder, grip, shaft, lead, turn) {
  const palm = add(grip, shaft, lead ? -leadHand : trailHand);
  const reach = add(palm, shoulder, -1);
  const axis = unit(reach);
  const upper = upperArm;
  const lower = lead ? leadForearm : trailForearm;
  const distance = Math.hypot(...reach);
  const reachWithinArm = clamp(distance, .14, upper + lower - .012);
  const along = (upper ** 2 - lower ** 2 + reachWithinArm ** 2) / (2 * reachWithinArm);
  const bend = Math.sqrt(upper ** 2 - along ** 2);
  // Bend along the turned torso so the elbow keeps its side as the chest opens.
  const side = lead ? .75 : -.84;
  const tuck = lead ? 0 : smooth(clamp(-turn / .85));
  const pole = [side * Math.cos(turn), -.46 - .49 * tuck, -side * Math.sin(turn) - .51 + .37 * tuck];
  const out = unit(add(pole, axis, -dot(pole, axis)));
  const elbow = add(add(shoulder, axis, along), out, bend);
  const wrist = add(palm, unit(add(elbow, palm, -1)), .055);
  return { shoulder: world(shoulder), elbow: world(elbow), wrist: world(wrist), palm: world(palm) };
}

// With no contact constraint, place the grip inside the intersection of the two
// arms' reaches. The staff follows the hands as the body turns.
function fitFreeGrip(grip, shaft, lead, trail, reach) {
  const center = add(lead, shaft, leadHand);
  const otherCenter = add(trail, shaft, -trailHand);
  const desired = add(grip, center, -1);
  const radius = clamp(Math.hypot(...desired), reach, upperArm + leadForearm - .012);
  const axis = unit(add(otherCenter, center, -1));
  const span = Math.hypot(...add(otherCenter, center, -1));
  const limit = upperArm + trailForearm - .013;
  const minCos = clamp((radius ** 2 + span ** 2 - limit ** 2) / (2 * radius * span), -1, 1);
  const handDirection = unit(desired);
  const cos = dot(handDirection, axis);
  if (cos >= minCos) return add(center, handDirection, radius);

  const tangent = unit(add(handDirection, axis, -cos));
  const withinReach = add(axis.map(value => value * minCos), tangent, Math.sqrt(1 - minCos ** 2));
  return add(center, withinReach, radius);
}

function fitFixedHead(anchor, hands, lead, trail, reach, length) {
  const { tip } = anchor;
  let direction = unit(anchor.direction ?? add(tip, hands, -1));
  let grip = add(tip, direction, -length);
  const fromTip = add(lead, tip, -1);
  const axis = unit(fromTip);
  const handRadius = length + leadHand;
  const span = Math.hypot(...fromTip);
  const cos = -dot(direction, axis);
  const reachCos = distance => (span ** 2 + handRadius ** 2 - distance ** 2) / (2 * span * handRadius);
  const minCos = clamp(reachCos(upperArm + leadForearm - .012), -1, 1);
  const maxCos = clamp(reachCos(reach), -1, 1);
  const withinReach = clamp(cos, minCos, maxCos);
  if (Math.abs(withinReach - cos) > .00001) {
    const tangent = unit(add(direction, axis, cos));
    direction = add(axis.map(value => -value * withinReach), tangent, Math.sqrt(1 - withinReach ** 2));
    grip = add(tip, direction, -length);
  }
  return fitTrail(grip, direction, tip, lead, trail, length);
}

// Both palms lie on the shaft. Move the handle around the head on the circle
// that preserves the lead arm's reach, stopping where the trail hand can reach it.
function fitTrail(grip, shaft, tip, lead, trail, length) {
  const palm = add(grip, shaft, trailHand);
  const maxReach = upperArm + trailForearm - .013;
  if (Math.hypot(...add(palm, trail, -1)) <= maxReach) return { grip, direction: shaft };

  const handle = shaft.map(value => -value);
  const toLead = unit(add(lead, tip, -1));
  const toTrail = add(trail, tip, -1);
  const parallel = dot(toTrail, toLead);
  const across = add(toTrail, toLead, -parallel);
  const width = Math.hypot(...across);
  const axial = dot(handle, toLead);
  const radial = Math.sqrt(Math.max(0, 1 - axial ** 2));
  if (width * radial < .00001) return { grip, direction: shaft };

  const handRadius = length - trailHand;
  const trailLimit = (dot(toTrail, toTrail) + handRadius ** 2 - maxReach ** 2) / (2 * handRadius);
  const angle = clamp((trailLimit - axial * parallel) / (width * radial), -1, 1);
  const toward = unit(across);
  const tangent = add(handle, toLead, -axial);
  const side = add(tangent, toward, -dot(tangent, toward));
  const sideLength = Math.hypot(...side);
  const onCircle = sideLength < .00001
    ? toward
    : add(toward.map(value => value * angle), side, Math.sqrt(1 - angle ** 2) / sideLength);
  const direction = add(toLead.map(value => -value * axial), onCircle, -radial);
  return { grip: add(tip, direction, -length), direction };
}

function blendAnchor(pose, anchor, hands, lead, trail, reach, length) {
  if (!anchor?.weight) return pose;
  const fixed = fitFixedHead(anchor, hands, lead, trail, reach, length);
  if (anchor.weight === 1) return fixed;
  const direction = unit(blend(pose.direction, fixed.direction, anchor.weight));
  const grip = fitFreeGrip(blend(pose.grip, fixed.grip, anchor.weight), direction, lead, trail, reach);
  return { grip, direction };
}

export function swingPose(practice, club) {
  const { pose, setup, contact } = club.head === 'putter' ? putterSwing(practice) : clubSwing(practice);
  const { hip, spine, turns, hands, shaft, leadReach: [leadReach], heel: [heel] } = pose;
  const [hipTurn, shoulderTurn, gaze] = turns;
  const chest = add(hip, spine);
  const head = add(chest, [.025, .245, .045 + (spine[2] - .09) * .55]);
  const leadShoulder = shoulderSocket(chest, shoulderTurn, 1);
  const trailShoulder = shoulderSocket(chest, shoulderTurn, -1);
  const authored = unit(shaft);
  const free = { direction: authored, grip: fitFreeGrip(hands, authored, leadShoulder, trailShoulder, leadReach) };
  const set = blendAnchor(free, setup, hands, leadShoulder, trailShoulder, leadReach, club.length);
  // Keep the grip low as the head passes the ball.
  const contactHands = contact && [contact.tip[0] + .015, .72, -.74];
  const { grip, direction } = blendAnchor(set, contact, contactHands,
    leadShoulder, trailShoulder, leadReach, club.length);
  const tip = add(grip, direction, club.length);
  return {
    hip: world(hip), chest: world(chest), head: world(head), hipTurn, shoulderTurn, gaze, heel,
    grip: world(grip), tip: world(tip),
    lead: arm(leadShoulder, grip, direction, true, shoulderTurn),
    trail: arm(trailShoulder, grip, direction, false, shoulderTurn),
  };
}
