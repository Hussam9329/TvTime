import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Returns the full application stylesheet as one string, in cascade order.
 * globals.css is only an import manifest, so source guards that look for CSS
 * patterns must read the partials it imports. `skip` drops imports whose path
 * ends with one of the given suffixes (e.g. the late layers that used to be
 * separate files).
 */
export const LATE_LAYERS = ["styles/themes/cinema.css", "styles/pages/catalogue-layout.css", "styles/pages/media-profile.css"];

export function readStyles(entry = "src/app/globals.css", { skip = [] } = {}) {
  const inline = (file) => readFileSync(file, "utf8").replace(
    /^@import\s+"(\.[^"]+\.css)";\s*$/gm,
    (_, path) => (skip.some((suffix) => path.endsWith(suffix)) ? "" : inline(resolve(dirname(file), path))),
  );
  return inline(resolve(entry));
}
