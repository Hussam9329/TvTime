import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

assert.ok(exists("src/lib/personal-rating.ts"), "personal rating domain file is required");
assert.ok(exists("src/components/media/structured-rating-dialog.tsx"), "structured rating dialog is required");
assert.ok(exists("prisma/migrations/20260907010000_structured_personal_rating/migration.sql"), "rating breakdown migration is required");

const schema = read("prisma/schema.prisma");
assert.match(schema, /ratingBreakdown\s+Json\?/);

const migration = read("prisma/migrations/20260907010000_structured_personal_rating/migration.sql");
assert.match(migration, /ADD COLUMN "ratingBreakdown" JSONB/i);

const dialog = read("src/components/media/structured-rating-dialog.tsx");
assert.match(dialog, /h-\[100dvh\]/, "mobile full-height responsive dialog is required");
assert.match(dialog, /Complete all criteria/);
assert.match(dialog, /criterion\.question/, "full criterion question must be visible in the dialog");
assert.doesNotMatch(dialog, /line-clamp[^\n]*criterion\.question/, "criterion questions must never be truncated");

const movieView = read("src/components/views/movie-detail-view.tsx");
const tvView = read("src/components/views/tv-detail-view.tsx");
const mediaCard = read("src/components/media/media-card.tsx");
assert.match(movieView, /StructuredRatingDialog/);
assert.match(tvView, /StructuredRatingDialog/);
assert.match(mediaCard, /StructuredRatingDialog/);
assert.match(tvView, /<RatingDialog[\s\S]*episode/i, "simple /100 dialog should remain available for episode ratings");

const mediaApi = read("src/app/api/media/[id]/route.ts");
assert.match(mediaApi, /validatePersonalRatingBreakdown/);
assert.match(mediaApi, /STRUCTURED_RATING_REQUIRED/);
assert.match(mediaApi, /validation\.score/, "server must derive canonical score from criteria");

const undo = read("src/lib/watch-undo-token.ts");
assert.match(undo, /ratingBreakdown/);

const transferTypes = read("src/lib/library-transfer-types.ts");
assert.match(transferTypes, /LIBRARY_BACKUP_VERSION\s*=\s*8/);
assert.match(transferTypes, /\[5, 6, 7, 8\]/);

const csv = read("src/app/api/library/export/csv/route.ts");
assert.match(csv, /ratingBreakdown/);

console.log("TVM-PATCH-14 source verification passed.");
