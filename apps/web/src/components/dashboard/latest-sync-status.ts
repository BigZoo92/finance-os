import type { PowensSyncRun } from "@/features/powens/types";

export type LatestSyncStatus = {
  badgeLabel: "OK" | "KO" | "RUN" | "-";
  badgeVariant: "secondary" | "destructive" | "outline";
  badgeClassName?: string;
  summary: string;
  details: string;
};

const INVALID_STATUS: LatestSyncStatus = {
  badgeLabel: "-",
  badgeVariant: "outline",
  summary: "Aucun run exploitable",
  details: "Aucune donnee de sync disponible.",
};

const toTimestamp = (value: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("fr-FR");
};

export const getLatestSyncStatus = (
  runs: PowensSyncRun[],
): LatestSyncStatus => {
  const sortedRuns = [...runs].sort(
    (left, right) => toTimestamp(right.startedAt) - toTimestamp(left.startedAt),
  );
  const latestRun = sortedRuns[0];

  if (!latestRun) {
    return {
      badgeLabel: "-",
      badgeVariant: "outline",
      summary: "Aucun run recent",
      details: "Aucune synchronisation worker tracee pour l'instant.",
    };
  }

  if (latestRun.result === "running") {
    return {
      badgeLabel: "RUN",
      badgeVariant: "outline",
      badgeClassName: "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      summary: `Run en cours depuis ${formatDateTime(latestRun.startedAt)}`,
      details: `Connexion ${latestRun.connectionId}`,
    };
  }

  const endedAt = latestRun.endedAt ?? latestRun.startedAt;

  if (latestRun.result === "success") {
    return {
      badgeLabel: "OK",
      badgeVariant: "secondary",
      badgeClassName: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      summary: `Succes le ${formatDateTime(endedAt)}`,
      details: `Connexion ${latestRun.connectionId}`,
    };
  }

  if (
    latestRun.result === "error" ||
    latestRun.result === "reconnect_required"
  ) {
    const failureReason =
      latestRun.result === "reconnect_required"
        ? "Reconnexion requise"
        : latestRun.errorMessage ?? "Erreur worker";

    return {
      badgeLabel: "KO",
      badgeVariant: "destructive",
      summary: `Echec le ${formatDateTime(endedAt)}`,
      details: failureReason,
    };
  }

  return INVALID_STATUS;
};
