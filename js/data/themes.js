// Seasonal and holiday themes. Colors live in css/styles.css; this file holds names, emoji and dates.
// `icon` is shown after the name in menus. `emoji` is the set used for decorations.

export const HOLIDAYS = {
  newyear:      { name: "New Year's",            icon: '🎆', stripe: ['#3b3f8f', '#c9a227'], emoji: ['🎆', '🎉', '🥂', '✨', '🎊'] },
  lunar:        { name: 'Lunar New Year',        icon: '🧧', stripe: ['#b3261e', '#c99a1d'], emoji: ['🧧', '🏮', '🐉', '🎊', '🍊'] },
  valentine:    { name: "Valentine's Day",       icon: '❤️', stripe: ['#b02a5b', '#e46f96'], emoji: ['❤️', '💕', '🌹', '💌', '💖'] },
  stpatrick:    { name: "St. Patrick's Day",     icon: '☘️', stripe: ['#1f7a3a', '#c9a227'], emoji: ['☘️', '🍀', '🌈', '💚'] },
  easter:       { name: 'Easter',                icon: '🐣', stripe: ['#6c4fb0', '#e88fb3'], emoji: ['🐣', '🥚', '🌷', '🐰', '🌼'] },
  pride:        { name: 'Pride Month',           icon: '🏳️‍🌈', stripe: ['#6a2c91', '#e8590c'], emoji: ['🏳️‍🌈', '🌈', '❤️', '🧡', '💛', '💚', '💙', '💜'] },
  independence: { name: 'Independence Day (US)', icon: '🇺🇸', stripe: ['#1f3f8a', '#c0262d'], emoji: ['🎆', '🇺🇸', '✨', '🎇', '⭐'] },
  halloween:    { name: 'Halloween',             icon: '🎃', stripe: ['#c2510f', '#5b2a86'], emoji: ['🎃', '👻', '🦇', '🕸️', '🍬'] },
  diwali:       { name: 'Diwali',                icon: '🪔', stripe: ['#b4500d', '#c9128a'], emoji: ['🪔', '✨', '🎇', '🌺', '🪷'] },
  thanksgiving: { name: 'Thanksgiving (US)',     icon: '🦃', stripe: ['#8c3b12', '#c98a12'], emoji: ['🦃', '🍂', '🥧', '🌽', '🍁'] },
  hanukkah:     { name: 'Hanukkah',              icon: '🕎', stripe: ['#1d4fa0', '#8aa4c8'], emoji: ['🕎', '✨', '🔵', '⭐', '🍩'] },
  christmas:    { name: 'Christmas',             icon: '🎄', stripe: ['#a3202a', '#1f6e3d'], emoji: ['🎄', '🎁', '❄️', '⭐', '🔔'] },
};

export const SEASONS = {
  spring: { name: 'Spring', icon: '🌸', stripe: ['#3d7d4a', '#d96a8f'], emoji: ['🌸', '🌷', '🦋', '🌱', '🌼'] },
  summer: { name: 'Summer', icon: '☀️', stripe: ['#0b7285', '#f08c00'], emoji: ['☀️', '🌴', '🌊', '🍉', '🕶️'] },
  autumn: { name: 'Autumn', icon: '🍂', stripe: ['#9a4a1c', '#c98a12'], emoji: ['🍁', '🍂', '🍃', '🌰', '🍄'] },
  winter: { name: 'Winter', icon: '❄️', stripe: ['#2f5d8a', '#6fa8d6'], emoji: ['❄️', '⛄', '🌨️', '🧣', '❄️'] },
};

/** "Christmas 🎄" style label used in menus and hints. */
export const themeLabel = (t) => `${t.name} ${t.icon}`;

// Lunisolar holidays have no simple formula, so their dates are listed per year as [month, day].
// Covers 2025 through 2036. Past 2036 these holidays are simply not auto-detected until the tables are extended.
//   LUNAR_NEW_YEAR: first day of the first lunar month (official China dates).
//   DIWALI: Lakshmi Puja, the main day (New Delhi calendar).
//   HANUKKAH: the evening the first candle is lit (the day before 25 Kislev).
export const LUNAR_NEW_YEAR = {
  2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3],
  2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28],
};
export const DIWALI = {
  2025: [10, 20], 2026: [11, 8], 2027: [10, 29], 2028: [10, 17], 2029: [11, 5], 2030: [10, 26],
  2031: [11, 14], 2032: [11, 2], 2033: [10, 22], 2034: [11, 10], 2035: [10, 30], 2036: [10, 18],
};
export const HANUKKAH = {
  2025: [12, 14], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12], 2029: [12, 1], 2030: [12, 20],
  2031: [12, 9], 2032: [11, 27], 2033: [12, 16], 2034: [12, 6], 2035: [12, 25], 2036: [12, 13],
};
