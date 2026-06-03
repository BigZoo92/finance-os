# Finance-OS - Direction Artistique

> Source de verite visuelle. Toute modification UI doit partir d'ici.
> Complement: `docs/frontend/design-system.md` pour les tokens/composants et
> `docs/context/DESIGN-DIRECTION.md` pour le contexte partage avec les agents.

## Vision - Command Pixel

Finance-OS est un cockpit financier personnel, dense, calme et lisible. La
direction courante est **Command Pixel**: une interface d'operations
personnelles inspiree des consoles de mission, des pixels nets, des surfaces
compactes et des signaux de statut clairs.

Parti pris: **moins de vitrine, plus de commande**. L'app doit ressembler a un
poste de pilotage personnel: decisions, flux, alertes, memoire et couts sont
visibles sans transformer l'ecran en page marketing.

Aurora Pink est l'ancienne direction. Les noms de tokens `aurora` peuvent
rester temporairement comme alias techniques, mais ils ne sont plus la source
de verite produit.

## Principes

1. Clarte avant densite: chaque page doit etre scannable en quelques secondes.
2. Surfaces compactes: privilegier panels, tableaux, listes et KPI stables.
3. Commandes visibles: les actions admin restent sous Ops/admin; le quotidien
   reste centre sur Cockpit, Depenses, Patrimoine et Advisor.
4. Pixel net: pas de glow gratuit, pas d'orbes decoratives, pas de gradients
   one-note. Les textures doivent soutenir la hierarchie.
5. Donnees financieres lisibles: montants en `.font-financial`; couleurs
   semantiques pour gain/perte/alerte.

## Palette

Command Pixel conserve les tokens existants pour limiter le risque avant les
maquettes finales:

| Role | Token | Usage |
|---|---|---|
| Primary | `--primary` | Accent de commande, focus, actif nav |
| Secondary | `--accent-2` | Accent admin/Ops, etats secondaires |
| Surfaces | `--surface-0/1/2/3` | Profondeur stable des panels |
| Positive | `--positive` | Revenus, gains, tendances positives |
| Negative | `--negative` | Depenses, pertes, tendances negatives |
| Warning | `--warning` | Attente, degradation, seuils |

Regle stricte: les couleurs de marque ne communiquent jamais un signal
financier. Utiliser `positive`, `negative` et `warning`.

## Typographie

- Inter Variable: texte, titres, navigation.
- JetBrains Mono Variable: montants, status lines, identifiants techniques.
- `.font-financial`: obligatoire pour les montants.
- Les titres hero doivent rester rares; les surfaces outil utilisent des
  headings compacts.

## Surfaces Canonique

Utiliser d'abord les primitives Finance-OS:

- `PageHeader` pour les pages `_app/*`
- `KpiTile` pour les chiffres de synthese
- `Panel` pour les sections de travail
- `RangePill` pour les controles de periode
- `BrandMark`, `AuroraBackdrop`, `StatusDot` lorsque le composant existe deja

Les noms herites (`AuroraBackdrop`, `.text-aurora`, etc.) sont des alias
techniques jusqu'a une migration de design system. Ne pas en deduire une
direction visuelle Aurora Pink.

## Motion

- Motion utile seulement: etat, chargement, changement de contexte.
- Respect obligatoire de `prefers-reduced-motion`.
- Eviter les animations decoratives continues sur les surfaces de travail.

## Anti-Patterns

- Page d'accueil marketing a la place de l'outil.
- Sidebar normale remplie de routes Ops/admin.
- Cartes imbriquees ou sections flottantes sans role.
- Gradients, halos, glassmorphism ou textures qui dominent les donnees.
- Couleurs brand pour signaler gain, perte, risque ou budget.

## Documentation

Tout ajout de route, token, pattern visuel ou composant partage doit mettre a
jour:

- `DESIGN.md`
- `docs/frontend/design-system.md`
- `docs/context/DESIGN-DIRECTION.md`
- `docs/frontend/information-architecture.md` si la navigation change
