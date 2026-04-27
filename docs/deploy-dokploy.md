# Deploy Dokploy

Le guide de deploiement Dokploy de reference est maintenant:

- [docs/deployment.md](/c:/Users/giver/dev/finance-os/docs/deployment.md)

Points cles:

- service Dokploy de type **Docker Compose**
- source recommandee: **Raw**
- images GHCR immuables
- `APP_IMAGE_TAG=vX.Y.Z`
- deploy pilote par GitHub Actions via l'API Dokploy officielle

## Troubleshooting

### `Head https://ghcr.io/v2/.../finance-os-knowledge-service/manifests/<tag>: denied`

Symptome: au moment du pull Dokploy, l'image `ghcr.io/<owner>/finance-os-knowledge-service:<tag>` echoue avec `denied`. Les autres images (web/api/worker) passent.

Cause possible #1 — l'image n'a jamais ete poussee: le workflow `release.yml` ne buildait que `web`/`api`/`worker`. Le job `build_and_push_knowledge_service` (Prompt 5B, 2026-04-27) est desormais ajoute pour pousser explicitement l'image knowledge-service vers GHCR a chaque release. Verifier dans l'onglet "Packages" du repo GitHub que `finance-os-knowledge-service:<tag>` existe.

Cause possible #2 — package GHCR prive sans credentials cote Dokploy: la reponse `denied` couvre aussi un 404 sur package prive. Soit publier le package en **public** (Settings > Packages > <package> > Change visibility), soit configurer un Docker registry credential `ghcr.io` dans Dokploy.

Remediation pour un tag deja publie (ex. `v9.0.0`) **avant** que le workflow n'ait ete corrige:

```sh
# build et push manuel pour ce tag specifique
docker build \
  -t ghcr.io/<owner>/finance-os-knowledge-service:v9.0.0 \
  apps/knowledge-service

echo "$GHCR_TOKEN" | docker login ghcr.io -u <owner> --password-stdin
docker push ghcr.io/<owner>/finance-os-knowledge-service:v9.0.0
```

Sinon, couper un nouveau tag (`v9.0.1`) qui declenchera le workflow corrige et poussera tous les images, puis bumper `APP_IMAGE_TAG` cote Dokploy.
