export const MAX_MANA = 100;
export const SPELL_MANA_COST = 40;
export const HOLE_MANA_RECOVERY = 16;

export function manaRecovery(spell, impact) {
  if (impact?.kind !== 'solid') return 0;
  if (!spell) return impact.snapQuality ? 18 : 12;
  if (spell.purity < .90) return 0;
  return Math.round(8 + (spell.purity - .90) * 120) + (impact.snapQuality ? 10 : 0);
}
