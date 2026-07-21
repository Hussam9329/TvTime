/** Canonical product identity used by user-facing UI and backup metadata. */
export const APP_NAME = "TvTime" as const;
export const APP_TAGLINE = "Your personal cinema companion" as const;
export const BACKUP_FILE_PREFIX = "tvtime-backup" as const;

/** Accepted only when importing older artifacts; never shown as the current name. */
export const LEGACY_APP_ALIASES = ["CineTrack"] as const;
