-- ============================================================
-- Schema Supabase — C'est quoi ce poulet ? Fantasy CDM 2026
-- À coller dans SQL Editor sur supabase.com
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Joueurs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS joueurs (
  id         INTEGER PRIMARY KEY,
  nom        TEXT NOT NULL,
  poste      TEXT NOT NULL CHECK (poste IN ('GAR', 'DEF', 'MIL', 'ATT')),
  nation     TEXT NOT NULL,
  valeur     DECIMAL(4,1) NOT NULL DEFAULT 5.0,
  photo      TEXT,
  actif      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Équipes fantasy ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom        TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Composition équipe ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipe_joueurs (
  equipe_id  UUID    NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  joueur_id  INTEGER NOT NULL REFERENCES joueurs(id),
  PRIMARY KEY (equipe_id, joueur_id)
);

-- ── Fixtures CDM ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixtures (
  id          INTEGER PRIMARY KEY,
  round       TEXT,
  date_heure  TIMESTAMPTZ,
  home_name   TEXT,
  away_name   TEXT,
  home_goals  INTEGER,
  away_goals  INTEGER,
  status      TEXT,
  home_logo   TEXT,
  away_logo   TEXT,
  home_winner BOOLEAN,
  away_winner BOOLEAN
);

-- ── Stats joueur par match ───────────────────────────────────
CREATE TABLE IF NOT EXISTS stats (
  id             SERIAL PRIMARY KEY,
  fixture_id     INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  joueur_id      INTEGER NOT NULL REFERENCES joueurs(id),
  minutes        INTEGER  DEFAULT 0,
  buts           INTEGER  DEFAULT 0,
  passes         INTEGER  DEFAULT 0,
  clean_sheet    BOOLEAN  DEFAULT false,
  arrets         INTEGER  DEFAULT 0,
  jaune          BOOLEAN  DEFAULT false,
  rouge          BOOLEAN  DEFAULT false,
  csc            INTEGER  DEFAULT 0,
  buts_encaisses INTEGER  DEFAULT 0,
  pen_arrete     BOOLEAN  DEFAULT false,
  pen_manque     BOOLEAN  DEFAULT false,
  UNIQUE (fixture_id, joueur_id)
);

-- ── Points par joueur/équipe/match ───────────────────────────
CREATE TABLE IF NOT EXISTS points (
  id         SERIAL  PRIMARY KEY,
  equipe_id  UUID    NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  joueur_id  INTEGER NOT NULL REFERENCES joueurs(id),
  points     DECIMAL(6,1) DEFAULT 0,
  detail     TEXT,
  UNIQUE (equipe_id, fixture_id, joueur_id)
);

-- ── Vue classement ───────────────────────────────────────────
CREATE OR REPLACE VIEW classement_view AS
SELECT
  e.id,
  e.nom,
  e.created_at,
  COALESCE(SUM(p.points), 0)::DECIMAL(10,1) AS pts_total,
  RANK() OVER (ORDER BY COALESCE(SUM(p.points), 0) DESC) AS rang
FROM equipes e
LEFT JOIN points p ON p.equipe_id = e.id
GROUP BY e.id, e.nom, e.created_at
ORDER BY pts_total DESC;

-- ── Vue buts par équipe ──────────────────────────────────────
CREATE OR REPLACE VIEW buts_equipe_view AS
SELECT
  ej.equipe_id,
  e.nom AS equipe_nom,
  COALESCE(SUM(s.buts), 0) AS buts_total
FROM equipe_joueurs ej
JOIN equipes e ON e.id = ej.equipe_id
LEFT JOIN stats s ON s.joueur_id = ej.joueur_id
GROUP BY ej.equipe_id, e.nom;

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE joueurs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_joueurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE points         ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout le monde peut voir)
CREATE POLICY "public_read" ON joueurs        FOR SELECT USING (true);
CREATE POLICY "public_read" ON equipes        FOR SELECT USING (true);
CREATE POLICY "public_read" ON equipe_joueurs FOR SELECT USING (true);
CREATE POLICY "public_read" ON fixtures       FOR SELECT USING (true);
CREATE POLICY "public_read" ON stats          FOR SELECT USING (true);
CREATE POLICY "public_read" ON points         FOR SELECT USING (true);

-- Création d'équipe ouverte à tous (inscription)
CREATE POLICY "public_insert_equipes"        ON equipes        FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert_equipe_joueurs" ON equipe_joueurs FOR INSERT WITH CHECK (true);

-- ── Feedback (device + remarques, collecté depuis le palmarès) ─
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device     TEXT CHECK (device IN ('mobile', 'desktop')),
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Écriture publique (un visiteur crée sa ligne à l'arrivée sur le palmarès,
-- puis peut la compléter avec un message). Une policy SELECT publique est
-- nécessaire même si on ne lit jamais depuis le site : PostgREST s'appuie
-- dessus pour retrouver la ligne ciblée par l'UPDATE (clause WHERE id=...).
CREATE POLICY "public_insert_feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_feedback" ON feedback FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_select_feedback" ON feedback FOR SELECT USING (true);
