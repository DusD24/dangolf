import { TEE_X } from './practice.js';

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

function frame(hip, spine, turns, hands, shaft, heel = 0) {
  return { hip, spine, turns, hands, shaft, heel: [heel] };
}

// Turns are pelvis, shoulders and gaze, in radians. Shaft points from hands to head.
const address = frame(
  [-.08, .78, -.98], [.035, .46, .25], [0, .04, 0],
  [.10, .83, -.70], [-.08, -.72, .69],
);
const takeaway = frame(
  [-.12, .78, -.98], [-.02, .46, .25], [-.14, -.42, -.04],
  [-.34, .83, -.66], [-.94, -.23, .24],
);
const halfway = frame(
  [-.17, .79, -.99], [-.085, .47, .25], [-.29, -.89, -.10],
  [-.51, 1.13, -.76], [-.72, .68, -.13],
);
const top = frame(
  [-.18, .80, -1.01], [-.06, .47, .25], [-.48, -1.28, -.14],
  [-.42, 1.55, -.93], [.31, .59, -.74],
);
const delivery = frame(
  [.035, .76, -.99], [-.12, .45, .24], [.43, -.36, -.06],
  [-.23, .93, -.58], [-.94, .25, .21], .025,
);
const impact = frame(
  [.14, .79, -1], [-.11, .44, .25], [.75, .24, 0],
  [.16, .85, -.67], [-.10, -.74, .67], .063,
);
const extension = frame(
  [.24, .84, -.99], [-.06, .46, .20], [1.05, .77, .30],
  [.59, 1.00, -.57], [.89, -.18, .41], .12,
);
const wrap = frame(
  [.27, .87, -.99], [.02, .46, .13], [1.25, 1.41, .84],
  [.61, 1.47, -.53], [.38, .86, .27], .18,
);
const finish = frame(
  [.29, .88, -.94], [.04, .47, .09], [1.34, 1.86, 1.27],
  [.58, 1.57, -.56], [.48, .11, -.87], .22,
);

const backswing = [[0, address], [.27, takeaway], [.66, halfway], [1, top]];
const strikeAngle = .13;
const finishAngle = 1.27;
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

  const through = angle <= strikeAngle
    ? .60 * clamp((angle - startAngle) / (strikeAngle - startAngle))
    : .60 + .40 * clamp((angle - strikeAngle) / (finishAngle - strikeAngle)) * (.60 + .40 * charge);
  const size = .46 + .54 * charge;
  const track = [
    [0, loaded], [.32, blendFrame(address, delivery, size)], [.60, impact],
    [.75, extension], [.88, wrap], [1, finish],
  ];
  const { x, y, z } = practice.club;
  // Match the simulated head through the hitting zone, then ease into the follow-through.
  const entering = smooth(clamp((angle + .46) / .43));
  const leaving = 1 - smooth(clamp((angle - .29) / .49));
  const contactWeight = entering * leaving;
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
    address.hands, [-.06 + travel * .5, -.78, .62]);
  return {
    pose,
    setup: { tip: [addressTip[0] + travel, .054 + Math.abs(travel) * .10, 0], weight: 1, direction: pose.shaft },
  };
}

function arm(chest, turn, grip, shaft, lead) {
  const side = lead ? 1 : -1;
  const shoulder = add(chest, [Math.cos(turn) * .22, Math.sin(turn) * .09, -Math.sin(turn) * .22], side);
  const palm = add(grip, shaft, lead ? -.034 : .047);
  const reach = add(palm, shoulder, -1);
  const axis = unit(reach);
  const upper = .34;
  const lower = lead ? .40 : .38;
  const distance = Math.hypot(...reach);
  const reachWithinArm = clamp(distance, .14, upper + lower - .012);
  const along = (upper ** 2 - lower ** 2 + reachWithinArm ** 2) / (2 * reachWithinArm);
  const bend = Math.sqrt(upper ** 2 - along ** 2);
  // The trail elbow folds toward the back pocket, then extends after contact.
  const pole = lead ? [.25, -1, -.20] : [-.64, -.75, -.50];
  const out = unit(add(pole, axis, -dot(pole, axis)));
  const elbow = add(add(shoulder, axis, along), out, bend);
  const wrist = add(palm, unit(add(elbow, palm, -1)), .055);
  return { shoulder: world(shoulder), elbow: world(elbow), wrist: world(wrist), palm: world(palm) };
}

function fitShaft(grip, direction, anchor, length) {
  const fitted = unit(anchor.direction ?? add(anchor.tip, grip, -1));
  return {
    grip: blend(grip, add(anchor.tip, fitted, -length), anchor.weight),
    direction: unit(blend(direction, fitted, anchor.weight)),
  };
}

export function swingPose(practice, club) {
  const { pose, setup, contact } = club.head === 'putter' ? putterSwing(practice) : clubSwing(practice);
  const { hip, spine, turns, hands, shaft, heel: [heel] } = pose;
  const [hipTurn, shoulderTurn, gaze] = turns;
  const chest = add(hip, spine);
  const head = add(chest, [.025, .245, .045 + (spine[2] - .09) * .55]);
  let { grip, direction } = fitShaft(hands, unit(shaft), setup, club.length);
  if (contact?.weight) ({ grip, direction } = fitShaft(grip, direction, contact, club.length));
  const tip = add(grip, direction, club.length);
  return {
    hip: world(hip), chest: world(chest), head: world(head), hipTurn, shoulderTurn, gaze, heel,
    grip: world(grip), tip: world(tip),
    lead: arm(chest, shoulderTurn, grip, direction, true),
    trail: arm(chest, shoulderTurn, grip, direction, false),
  };
}
