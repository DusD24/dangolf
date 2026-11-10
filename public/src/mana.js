export const MAX_MANA = 100;
export const SPELL_MANA_COST = 40;
export const HOLE_MANA_RECOVERY = 16;
const PLAIN_MANA = 12;
const SNAP_MANA = 18;

export function manaRecovery(spell, impact) {
  if (impact?.kind !== 'solid') return 0;
  if (!spell) return impact.snapQuality ? SNAP_MANA : PLAIN_MANA;
  if (spell.purity < .90) return 0;
  return Math.round(8 + (spell.purity - .90) * 120) + (impact.snapQuality ? 10 : 0);
}

export function manaPlan(balance, putting = false) {
  if (putting) return 'Mana ' + balance + '/' + MAX_MANA + ' · Putting uses no mana.';
  const plain = Math.min(MAX_MANA, balance + PLAIN_MANA);
  const snap = Math.min(MAX_MANA, balance + SNAP_MANA);
  const next = balance >= SPELL_MANA_COST ? 'Spell ready' :
    plain >= SPELL_MANA_COST ? 'Plain strike readies a spell' :
    snap >= SPELL_MANA_COST ? 'Centered snap readies a spell' : 'Need ' + (SPELL_MANA_COST - balance) + ' to cast';
  return 'Mana ' + balance + '/' + MAX_MANA + ' · Solid plain → ' + plain +
    ' · Centered plain → ' + snap + ' · ' + next + '.';
}
