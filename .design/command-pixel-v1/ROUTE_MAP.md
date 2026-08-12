# Route Map

This document mirrors the final `01 Navigation et routes` frame.

## Desktop

### Cockpit

Top level destination.

### Argent

Dropdown destinations:

- Dépenses
- Patrimoine
- Investissements
- Objectifs

### IA

Dropdown destinations:

- Advisor
- Chat
- Mémoire 3D

### Radar

Top level destination.

### Social Intelligence

Separate canonical screen in the Radar product area.

### Ops

Visible in Admin mode only.

Dropdown destinations:

- Orchestration
- Coûts
- Intégrations
- Santé

## Mobile

Primary navigation:

- Cockpit
- Dépenses
- Patrimoine
- Advisor
- Plus

Secondary destinations such as Chat, Mémoire, Radar, Social Intelligence and Ops in Admin mode live under Plus or contextual navigation.

## Auth

Login is the entry screen.

## Product boundaries

- Radar observes. Advisor recommends.
- Santé detects. Intégrations and Orchestration resolve.
- Chat answers and can link toward the relevant product page.
- Coûts measures. It does not run jobs.
- IBKR and Binance are configured on the server. They never expose credential entry in the UI.
