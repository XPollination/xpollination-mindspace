-- Mission: Unternehmensstruktur — organizational structure, asset ownership, investment plans
-- Status: draft (pending scope definition with Robin's workspace analysis)

-- Ensure project exists (FK target)
INSERT OR IGNORE INTO projects (id, slug, name, created_by) VALUES ('proj-governance', 'xpollination-governance', 'Xpollination Governance', 'system');

INSERT OR IGNORE INTO missions (id, title, description, status, project_slug, short_id, content_md, content_version)
VALUES (
  'mission-unternehmensstruktur',
  'Unternehmensstruktur',
  'Organisationsstruktur erarbeiten: welche Instanz besitzt welche Assets, Investitionspläne, Open-Source-Ansatz, Non-Profit-Organisationsstruktur.',
  'draft',
  'xpollination-governance',
  lower(hex(randomblob(4))),
  '# Mission: Unternehmensstruktur

## Ziel

Die rechtliche und organisatorische Struktur von XPollination definieren — wer besitzt was, wie fließen Investitionen, und wie verbinden sich Open-Source-Philosophie mit Non-Profit-Governance.

## Leitprinzip: Zwei-Schichten-Modell

### Layer 1 — Technologie-Stack (Open Source)
Grundbausteine wie Brain, Authentifizierung, A2A-Protokoll sind **Open Source** (AGPL-3.0). Sie bilden die Infrastruktur, auf der alle aufbauen. Community kann beitragen, forken, nutzen.

### Layer 2 — Workflows & Ideen (Geschützt)
Workflows, Prozesse und Geschäftslogik die AUF dem Stack entstehen, sind **nicht Open Source**. Sie gehören anteilig den Schöpfern — proportional zu den eingebrachten Ideen. Die Provenance Chain trackt, wer was beigetragen hat. Token Economics verteilen den Wert fair.

**Die Grenze:** Der Stack ist das Werkzeug (frei verfügbar). Was damit gebaut wird, gehört denen, die es erdacht haben.

## Kernfragen

### 1. Instanzen & Assets
- Welche rechtlichen Entitäten existieren oder werden benötigt? (Verein, GmbH, Stiftung, ...)
- Welche Instanz besitzt welche Assets? (Code-Repos, Infrastruktur, Domains, Daten, IP)
- Layer 1 Assets (Stack) vs. Layer 2 Assets (Workflows) — unterschiedliche Eigentümerstruktur?
- Wie verhält sich Asset-Ownership zum Provenance-Chain-System?

### 2. Investitionspläne
- Wie wird Entwicklung finanziert? (Bootstrapping, Grants, Impact-Investing, ...)
- Welche Investitionen sind geplant? (Infrastruktur, Personal, Community)
- Wie wird der ROI gemessen — im Non-Profit-Kontext?
- Investitionen in Layer 1 (Community-getrieben) vs. Layer 2 (Schöpfer-getrieben)?

### 3. Open-Source-Ansatz
- Layer 1 Repos = public (AGPL-3.0): mindspace, hive, brain, A2A
- Layer 2 Repos = protected: governance, workflows, Geschäftslogik
- Wie schützt man Workflow-IP und ermöglicht trotzdem Stack-Beiträge?
- Zusammenspiel mit Token-Economics / Fair Attribution / Provenance Chain

### 4. Non-Profit-Struktur
- Vereinsstruktur nach österreichischem/deutschem Recht?
- Governance: Vorstand, Mitgliederversammlung, Beirat?
- Non-Profit als Hüter von Layer 1 (Stack)? Schöpfer-Ownership für Layer 2?
- Steuerliche Aspekte (Gemeinnützigkeit, Spendenabsetzbarkeit)

## Verbindung zu bestehenden Missionen

- **Fair Attribution** — Provenance Chain definiert WER beigetragen hat. Diese Mission definiert WELCHER INSTANZ der Wert gehört und WIE die Zwei-Schichten-Trennung rechtlich abgesichert wird.
- **Structured Knowledge Objects** — SKO-Architektur bildet die operative Struktur. Diese Mission definiert die RECHTLICHE Struktur darüber.

## Bestehende Entscheidungen (aus Brain)
- AGPL-3.0 für Mindspace bestätigt (Thomas)
- Value Weighting Research: 5 Patterns evaluiert für Revenue-Distribution
- Provenance Chain trackt Authors + Contributions durchgängig
- Mission Composition Model ermöglicht Token-Distribution at scale

## Status

**Draft** — Leitprinzip (Zwei-Schichten-Modell) definiert. Wartet auf Input aus Robins Workspace-Analyse.
',
  1
);
