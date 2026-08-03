/** Canonical product identity used by user-facing UI and backup metadata. */
export const APP_NAME = "Trakora" as const;
export const APP_TAGLINE = "Track every story" as const;
export const BACKUP_FILE_PREFIX = "trakora-backup" as const;

/** Accepted only when importing older artifacts; never shown as the current name. */
export const LEGACY_APP_ALIASES = ["TvTime", "CineTrack"] as const;
