#!/usr/bin/env node
import { readFileSync } from "node:fs";

const failures = [];
const read = (path) => readFileSync(path, "utf8");
const requireText = (path, pattern, message) => {
  if (!pattern.test(read(path))) failures.push(`${path}: ${message}`);
};

const undoHook = "src/hooks/use-watch-undo.ts";
requireText(undoHook, /duration:\s*5_000/, "Undo must remain visible for exactly five seconds");
requireText(undoHook, /label:\s*"Undo"/, "Undo action is missing");
requireText(undoHook, /\/api\/library\/watch-undo/, "Undo endpoint is not called");
requireText("src/lib/watch-undo-token.ts", /SignJWT[\s\S]*setExpirationTime\(WATCH_UNDO_TOKEN_TTL\)/, "Undo state must use a signed, expiring token");
requireText("src/app/api/library/watch-undo/route.ts", /undo\.userId !== userId/, "Undo ownership is not enforced");

for (const path of [
  "src/components/media/media-card.tsx",
  "src/components/views/movie-detail-view.tsx",
  "src/components/views/collection-world-view.tsx",
  "src/components/views/watch-next-view.tsx",
  "src/components/views/tv-detail-view.tsx",
]) {
  requireText(path, /useWatchUndo\(/, "viewing actions are not connected to five-second Undo");
}

const notificationRoute = "src/app/api/notifications/sync/route.ts";
const notificationServer = "src/lib/notification-sync-server.ts";
requireText(notificationRoute, /syncNotificationsForUser\(user\.id,\s*\{\s*sendPush:\s*true\s*\}\)/, "authenticated sync route does not delegate to the notification service");
requireText(notificationServer, /"season_premiere"/, "season premiere notifications are missing");
requireText(notificationServer, /"season_finale"/, "season finale notifications are missing");
requireText(notificationServer, /"not_started",\s*"watching",\s*"uptodate"/, "followed shows that have not started are excluded");
requireText(notificationServer, /isSeasonFinale\(episode, season\.episodes/, "finale is not verified against current season metadata");
requireText(notificationServer, /notificationId[\s\S]*skipDuplicates:\s*true/, "concurrent season syncs can create duplicate alerts");
requireText("src/components/views/notification-center.tsx", /season_premiere[\s\S]*season_finale/, "new season types are not rendered in the notification center");

for (const path of [
  "src/components/views/movie-detail-view.tsx",
  "src/components/views/tv-detail-view.tsx",
]) {
  if (/Where to Watch|WatchProviders|watch\/providers|JustWatch/i.test(read(path))) {
    failures.push(`${path}: retired Where to Watch code was reintroduced`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("PASS: five-second Undo and season alert source guards");
