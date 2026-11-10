import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLUBS } from '../public/src/clubs.js';
import { Practice } from '../public/src/practice.js';
import { swingPose } from '../public/src/swing-pose.js';

const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('the shaft keeps its fitted length and reaches the physical strike', () => {
  const practice = new Practice();
  const club = CLUBS.driver;
  practice.beginStroke(0, 0);
  practice.moveStroke(0, .45);
  practice.releaseStroke(0, 0);
  for (let i = 0; i < 115; i++) {
    practice.step();
    const pose = swingPose(practice, club);
    assert.ok(Math.abs(length(pose.grip, pose.tip) - club.length) < 1e-9);
    if (practice.impact?.at === practice.elapsed) assert.ok(length(pose.tip, practice.club) < .001);
  }
  assert.ok(practice.impact);
});

test('address, top and finish shift the body through a planted stance', () => {
  const practice = new Practice();
  const club = CLUBS.iron7;
  const address = swingPose(practice, club);
  assert.ok(address.chest.z - address.hip.z > .19);
  assert.ok(address.grip.y < address.chest.y);
  assert.equal(address.heel, 0);

  practice.beginStroke(0, 0);
  practice.moveStroke(0, .45);
  const top = swingPose(practice, club);
  assert.ok(top.shoulderTurn < -.8);
  assert.ok(top.grip.y > top.chest.y);
  assert.ok(top.tip.y > top.head.y);
  assert.equal(top.heel, 0);

  practice.releaseStroke(0, 0);
  for (let i = 0; i < 125; i++) practice.step();
  const finish = swingPose(practice, club);
  assert.ok(finish.hip.x > address.hip.x + .20);
  assert.ok(finish.heel > .13);
  assert.ok(finish.shoulderTurn > 1);
  assert.ok(finish.grip.y > finish.chest.y);
});

test('the staff clears the head during the turn and stays in both hands', () => {
  const practice = new Practice();
  const club = CLUBS.driver;

  function checkPose() {
    const { head, grip, tip, lead, trail } = swingPose(practice, club);
    const dx = tip.x - grip.x;
    const dy = tip.y - grip.y;
    const dz = tip.z - grip.z;
    const along = point => ((point.x - grip.x) * dx + (point.y - grip.y) * dy + (point.z - grip.z) * dz) /
      club.length ** 2;
    const onShaft = t => ({ x: grip.x + dx * t, y: grip.y + dy * t, z: grip.z + dz * t });
    assert.ok(length(head, onShaft(Math.max(0, Math.min(1, along(head))))) > .24);
    assert.ok(length(lead.palm, onShaft(along(lead.palm))) < .001);
    assert.ok(length(trail.palm, onShaft(along(trail.palm))) < .001);
    assert.ok(along(lead.palm) < along(trail.palm));
  }

  practice.beginStroke(0, 0);
  for (let i = 0; i <= 40; i++) {
    practice.moveStroke(0, .45 * i / 40);
    checkPose();
  }
  practice.releaseStroke(0, 0);
  while (practice.phase === 'swing') {
    practice.step();
    checkPose();
  }
});
