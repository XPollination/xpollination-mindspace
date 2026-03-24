-- Mission: Unternehmensstruktur — organizational structure, asset ownership, investment plans
-- Status: draft (pending scope definition with Robin's workspace analysis)

INSERT OR IGNORE INTO missions (id, title, description, status, project_slug, short_id, content_md, content_version)
VALUES (
  'mission-unternehmensstruktur',
  'Unternehmensstruktur',
  'Organisationsstruktur erarbeiten: welche Instanz besitzt welche Assets, Investitionspläne, Open-Source-Ansatz, Non-Profit-Organisationsstruktur.',
  'draft',
  'xpollination-mindspace',
  lower(hex(randomblob(4))),
  '# Mission: Unternehmensstruktur

## Ziel

Die rechtliche und organisatorische Struktur von XPollination definieren — wer besitzt was, wie fließen Investitionen, und wie verbinden sich Open-Source-Philosophie mit Non-Profit-Governance.

## Kernfragen

### 1. Instanzen & Assets
- Welche rechtlichen Entitäten existieren oder werden benötigt? (Verein, GmbH, Stiftung, ...)
- Welche Instanz besitzt welche Assets? (Code-Repos, Infrastruktur, Domains, Daten, IP)
- Wie verhält sich Asset-Ownership zum Provenance-Chain-System?

### 2. Investitionspläne
- Wie wird Entwicklung finanziert? (Bootstrapping, Grants, Impact-Investing, ...)
- Welche Investitionen sind geplant? (Infrastruktur, Personal, Community)
- Wie wird der ROI gemessen — im Non-Profit-Kontext?

### 3. Open-Source-Ansatz
- Welche Repos sind public vs. private?
- Lizenzstrategie (MIT, AGPL, Dual-Licensing?)
- Wie schützt man IP und ermöglicht trotzdem Community-Beiträge?
- Zusammenspiel mit Token-Economics / Fair Attribution

### 4. Non-Profit-Struktur
- Vereinsstruktur nach österreichischem/deutschem Recht?
- Governance: Vorstand, Mitgliederversammlung, Beirat?
- Wie verbinden sich Non-Profit-Governance und agile Agent-Workflows?
- Steuerliche Aspekte (Gemeinnützigkeit, Spendenabsetzbarkeit)

## Verbindung zu bestehenden Missionen

- **Fair Attribution** — Token-Economics und Provenance Chain definieren, WER beigetragen hat. Diese Mission definiert, WELCHER INSTANZ der Wert gehört.
- **Structured Knowledge Objects** — Die SKO-Architektur (Mission > Capability > Task) bildet die operative Struktur. Diese Mission definiert die RECHTLICHE Struktur darüber.

## Status

**Draft** — Wartet auf Input aus Robins anderem Workspace (wird im nächsten Schritt analysiert).
',
  1
);
