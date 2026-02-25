# Dokploy Environment Variables

La reference complete des variables Dokploy est documentee ici:

- [docs/deployment.md](/c:/Users/giver/dev/finance-os/docs/deployment.md)

Rappels critiques:

- `GHCR_IMAGE_NAME=ghcr.io/bigzoo92/finance-os`
- `APP_IMAGE_TAG=vX.Y.Z`
- ne jamais utiliser `latest`
- ne jamais definir `VITE_PRIVATE_ACCESS_TOKEN`
- preferer `AUTH_ADMIN_PASSWORD_HASH_B64`
