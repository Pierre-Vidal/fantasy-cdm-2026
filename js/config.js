// ============================================================
// config.js — Remplis ces valeurs depuis ton dashboard Supabase
// Settings > API > Project URL + anon public key
// ============================================================
const CONFIG = {
  SUPABASE_URL:      'https://ispatiztwraeguvakwkl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcGF0aXp0d3JhZWd1dmFrd2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDEwODUsImV4cCI6MjA5NjkxNzA4NX0.73H8ADdPcEdGPjFH9O6FWr_VwCMXGKLMtZawoAm6trI',

  BUDGET_MAX:    110,
  NB_JOUEURS:    15,
  COMPO_REQUISE: { GAR: 2, DEF: 5, MIL: 5, ATT: 3 },

  BAREME: {
    GAR: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 1, penArrete: 5, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
    DEF: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 0, penArrete: 0, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
    MIL: { moins60: 1, min60: 2, but: 5, passe: 3, cleanSheet: 1, arrets3: 0, penArrete: 0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
    ATT: { moins60: 1, min60: 2, but: 4, passe: 3, cleanSheet: 0, arrets3: 0, penArrete: 0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
  },

  COLORS: {
    GAR: '#f0883e',
    DEF: '#388bfd',
    MIL: '#3fb950',
    ATT: '#f85149',
  },

  POS_ORDER: ['GAR', 'DEF', 'MIL', 'ATT'],
};
