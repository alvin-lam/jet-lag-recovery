// Seasonal and holiday themes. Colors live in css/styles.css; this file holds names, emoji and dates.

export const HOLIDAYS = {
  newyear:      { name: "New Year's",            emoji: ['🎆', '🎉', '🥂', '✨', '🎊'] },
  lunar:        { name: 'Lunar New Year',        emoji: ['🧧', '🏮', '🐉', '🎊', '🍊'] },
  valentine:    { name: "Valentine's Day",       emoji: ['❤️', '💕', '🌹', '💌', '💖'] },
  stpatrick:    { name: "St. Patrick's Day",     emoji: ['☘️', '🍀', '🌈', '💚'] },
  easter:       { name: 'Easter',                emoji: ['🐣', '🥚', '🌷', '🐰', '🌼'] },
  independence: { name: 'Independence Day (US)', emoji: ['🎆', '🇺🇸', '✨', '🎇', '⭐'] },
  halloween:    { name: 'Halloween',             emoji: ['🎃', '👻', '🦇', '🕸️', '🍬'] },
  diwali:       { name: 'Diwali',                emoji: ['🪔', '✨', '🎇', '🌺', '🪷'] },
  thanksgiving: { name: 'Thanksgiving (US)',     emoji: ['🦃', '🍂', '🥧', '🌽', '🍁'] },
  hanukkah:     { name: 'Hanukkah',              emoji: ['🕎', '✨', '🔵', '⭐', '🍩'] },
  christmas:    { name: 'Christmas',             emoji: ['🎄', '🎁', '❄️', '⭐', '🔔'] },
};

export const SEASONS = {
  spring: { name: 'Spring', emoji: ['🌸', '🌷', '🦋', '🌱', '🌼'] },
  summer: { name: 'Summer', emoji: ['☀️', '🌴', '🌊', '🍉', '🕶️'] },
  autumn: { name: 'Autumn', emoji: ['🍁', '🍂', '🍃', '🌰', '🍄'] },
  winter: { name: 'Winter', emoji: ['❄️', '⛄', '🌨️', '🧣', '❄️'] },
};

// Lunisolar holidays have no simple formula. Values are [month, day] of the first day.
export const LUNAR_NEW_YEAR = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11] };
export const DIWALI         = { 2025: [10, 20], 2026: [11, 8], 2027: [10, 29], 2028: [10, 17], 2029: [11, 5], 2030: [10, 26], 2031: [11, 14], 2032: [11, 2] };
export const HANUKKAH       = { 2025: [12, 14], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12], 2029: [12, 1], 2030: [12, 20], 2031: [12, 9], 2032: [11, 27] };
