// Head outlines use the same proportions in the bag and on the staff.
export const CLUB_HEADS = {
  driver: 'M-8 -8 Q1 -12 11 -6 Q15 -2 13 6 Q8 13 -8 9 L-10 3 Z',
  wood: 'M-8 -6 Q1 -10 10 -5 Q14 -1 10 7 Q3 10 -8 7 L-9 2 Z',
  hybrid: 'M-8 -5 Q1 -8 9 -3 L12 3 Q6 8 -8 6 L-9 1 Z',
  iron: 'M-9 -5 L8 -6 L11 -2 L8 6 L-8 6 L-10 2 Z',
  wedge: 'M-8 -6 L7 -8 Q12 -6 11 -1 L7 7 L-9 6 L-10 1 Z',
  putter: 'M-10 -6 H9 L12 -1 L9 7 H-10 L-12 2 Z',
};

export const CLUBS = {
  driver: { name: 'Driver', short: 'DR', head: 'driver', speed: 1, loft: 0, length: 1.15, size: 1.16 },
  wood3: { name: '3 Wood', short: '3W', head: 'wood', speed: .92, loft: .035, length: 1.10, size: 1.05 },
  wood5: { name: '5 Wood', short: '5W', head: 'wood', speed: .86, loft: .07, length: 1.07, size: .94 },
  hybrid4: { name: '4 Hybrid', short: '4H', head: 'hybrid', speed: .80, loft: .10, length: 1.02, size: 1 },
  iron5: { name: '5 Iron', short: '5I', head: 'iron', speed: .75, loft: .135, length: .98, size: 1.01 },
  iron6: { name: '6 Iron', short: '6I', head: 'iron', speed: .70, loft: .17, length: .96, size: .98 },
  iron7: { name: '7 Iron', short: '7I', head: 'iron', speed: .66, loft: .205, length: .95, size: .95 },
  iron8: { name: '8 Iron', short: '8I', head: 'iron', speed: .62, loft: .24, length: .94, size: .92 },
  iron9: { name: '9 Iron', short: '9I', head: 'iron', speed: .58, loft: .28, length: .93, size: .90 },
  wedge: { name: 'Pitching Wedge', short: 'PW', head: 'wedge', speed: .54, loft: .32, length: .92, size: 1.01 },
  gap: { name: 'Gap Wedge', short: 'GW', head: 'wedge', speed: .49, loft: .37, length: .91, size: .98 },
  sand: { name: 'Sand Wedge', short: 'SW', head: 'wedge', speed: .43, loft: .42, length: .90, size: 1.09 },
  pitch: { name: 'Lob Wedge', short: 'LW', head: 'wedge', speed: .36, loft: .47, length: .89, size: .92 },
  putter: { name: 'Putter', short: 'PT', head: 'putter', speed: 0, loft: 0, length: .87, size: 1.04 },
};
