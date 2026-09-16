import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real request handlers with isolated persistence and no live data.
function loadModule(file, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, console, Date,
    require(name) {
      assert.ok(name in imports, `Unexpected dependency: ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return exports;
}

const domain = loadModule("src/lib/personal-rating.ts");
const DbNull = { databaseNull: true };
let item;
let writes;
let eligible;
let completionCalls;
function reset(type = "movie") {
  item = { id: "test-media", userId: "test-user", type, tmdbId: 1, status: null, watched: false, userRating: null, ratingBreakdown: null };
  writes = 0;
  completionCalls = 0;
  eligible = true;
}
function save(data) {
  writes++;
  item = { ...item, ...data };
  if (item.ratingBreakdown === DbNull) item.ratingBreakdown = null;
  return item;
}
const imports = {
  "next/server": { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, body }) } },
  "@prisma/client": { Prisma: { DbNull } },
  "@/lib/db": { db: { media: {
    findFirst: async ({ where }) => where.userId === item.userId ? item : null,
    findUnique: async () => item,
    update: async ({ data }) => save(data),
    upsert: async ({ update }) => save(update),
  } } },
  "@/lib/user": { getOrCreateUser: async () => ({ id: "test-user" }) },
  "@/lib/auth": { resolveUserId: async () => "test-user" },
  "@/lib/media-normalize": { normalizeMedia: (value) => value },
  "@/lib/tv-status-engine": { normalizeTvTrackingState: (value) => value },
  "@/lib/tv-rating-eligibility": {
    saveTvCompletionRating: async ({ rating, ratingBreakdown }) => {
      completionCalls++;
      return { item: eligible ? save({ userRating: rating, ratingBreakdown, watched: true, status: "finished" }) : null, eligibility: {} };
    },
    tvRatingEligibilityError: () => ({ message: "Finish all episodes first", code: "TV_RATING_NOT_ELIGIBLE" }),
  },
  "@/lib/watch-undo-token": { issueWatchUndoToken: async () => "test-undo", mediaWatchSnapshot: (value) => value },
  "@/lib/personal-rating": domain,
};
const { PATCH } = loadModule("src/app/api/media/[id]/route.ts", imports);
const { POST } = loadModule("src/app/api/library/watched-movies/route.ts", imports);
const patch = (body) => PATCH({ json: async () => body }, { params: Promise.resolve({ id: "test-media" }) });
const criteria = domain.buildPersonalRatingBreakdown("movie", Object.fromEntries(domain.PERSONAL_RATING_KEYS.map((key) => [key, 8])));

for (const score of [0, 85, 100]) {
  reset();
  const result = await patch({ userRating: score, ratingBreakdown: null, watched: true, status: "watched" });
  assert.equal(result.status, 200);
  assert.equal(item.userRating, score);
  assert.equal(item.watched, true);
  assert.equal(item.ratingBreakdown, null);
  assert.equal(result.body.undoToken, "test-undo");
}
reset();
assert.equal((await patch({ ratingBreakdown: criteria, userRating: 100, watched: true })).status, 200);
assert.equal(item.userRating, 80, "Detailed ratings use their criteria sum");
assert.equal((await patch({ userRating: 67, ratingBreakdown: null })).status, 200);
assert.equal(item.userRating, 67);
assert.equal(item.ratingBreakdown, null, "Direct re-rating clears the previous criteria");
assert.equal((await patch({ ratingBreakdown: criteria })).status, 200);
assert.equal(item.userRating, 80, "Switching back to criteria is supported");
assert.equal((await patch({ userRating: null, watched: false, status: null })).status, 200);
assert.equal(item.userRating, null);
assert.equal(item.ratingBreakdown, null);

for (const score of [-1, 101, 7.5, "80", "", true]) {
  reset();
  assert.equal((await patch({ userRating: score, watched: true })).status, 400);
  assert.equal(writes, 0, "Invalid scores must never change watch state");
}
reset();
assert.equal((await patch({ watched: true })).status, 409);
assert.equal(writes, 0, "Completion still requires a rating");
item.userId = "another-user";
assert.equal((await patch({ userRating: 90 })).status, 404);
assert.equal(writes, 0, "The ownership boundary remains enforced");

for (const score of [0, 100]) {
  reset("series");
  assert.equal((await patch({ userRating: score, ratingBreakdown: null })).status, 200);
  assert.equal(item.userRating, score);
  assert.equal(item.status, "finished");
  assert.equal(completionCalls, 1, "Direct TV ratings still pass through the completion eligibility service");
  assert.equal((await patch({ ratingBreakdown: null })).status, 200);
  assert.equal(item.status, "uptodate");
  assert.equal(item.watched, false);
}
reset("series");
eligible = false;
assert.equal((await patch({ userRating: 90 })).status, 409);
assert.equal(writes, 0, "An unfinished series cannot bypass episode eligibility");

reset();
const compat = await POST({ json: async () => ({ tmdbId: 1, title: "Test movie", userRating: 0 }) });
assert.equal(compat.status, 200);
assert.equal(item.userRating, 0);
assert.equal(item.watched, true);
console.log("Direct personal rating request tests passed.");
