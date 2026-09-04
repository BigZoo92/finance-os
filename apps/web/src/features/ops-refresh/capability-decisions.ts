export type OpsCapabilityDecision =
  | 'WIRE'
  | 'INTERNAL ONLY'
  | 'REMOVE DEAD CLIENT'
  | 'KEEP FOR LATER'

export const OPS_CAPABILITY_DECISIONS = [
  {
    capability: 'free-firehose-estimate',
    decision: 'WIRE',
    reason: 'Prépare une exécution Admin avec volume et limite hebdomadaire avant confirmation.',
  },
  {
    capability: 'free-firehose-run',
    decision: 'WIRE',
    reason: 'Le test sans enregistrement et le lancement confirmé appartiennent au détail Social.',
  },
  {
    capability: 'x-daily-sync',
    decision: 'WIRE',
    reason: 'Le test sans dépense et la synchronisation confirmée appartiennent au détail Social.',
  },
  {
    capability: 'x-resolve-all',
    decision: 'WIRE',
    reason: 'La résolution confirmée des sources X est une opération de maintenance utile.',
  },
  {
    capability: 'x-health',
    decision: 'WIRE',
    reason: 'La date de la dernière synchronisation alimente la fraîcheur Social dans Santé.',
  },
  {
    capability: 'knowledge-enrichment-ensure',
    decision: 'KEEP FOR LATER',
    reason:
      'L’initialisation reste dans la surface Mémoire existante jusqu’à la création d’un job enregistré.',
  },
  {
    capability: 'derived-recompute-post',
    decision: 'REMOVE DEAD CLIENT',
    reason:
      'Orchestration passe par le job Transactions qui applique les mêmes protections serveur.',
  },
] as const satisfies ReadonlyArray<{
  capability: string
  decision: OpsCapabilityDecision
  reason: string
}>
