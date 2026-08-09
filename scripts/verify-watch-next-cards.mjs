#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const view = read("src/components/views/watch-next-view.tsx");
const styles = read("src/app/globals.css");

const cardMarkup = view.slice(
  view.indexOf("function CompactWatchCard"),
  view.indexOf("function ProgressBar"),
);
const cardStyles = styles.slice(
  styles.indexOf(".tvtime-watch-card-grid"),
  styles.indexOf(".tvtime-watch-collapsible"),
);

const checks = [
  [
    /function WatchSection[\s\S]*<CompactWatchCard/.test(view)
      && ["Continue Watching", "New Episodes", "Falling Behind", "Paused"].every((label) => view.includes(label)),
    "Every active Watch Next series section shares the redesigned compact card",
  ],
  [
    /tvtime-watch-card__topline/.test(cardMarkup)
      && /episodes ready/.test(cardMarkup)
      && /tvtime-watch-card__episode/.test(cardMarkup)
      && /tvtime-watch-card__meta/.test(cardMarkup)
      && /<ProgressBar item=\{item\}/.test(cardMarkup),
    "The shorter card retains status, ready count, episode, runtime, release and progress information",
  ],
  [
    !/-webkit-line-clamp/.test(cardStyles)
      && !/\.tvtime-watch-card__ready\s*\{[^}]*text-overflow/s.test(cardStyles),
    "Long series and episode text can wrap instead of silently removing card information",
  ],
  [
    /className="tvtime-watch-card__mark" onClick=\{onMark\} disabled=\{disabled\}/.test(cardMarkup)
      && /className="tvtime-watch-card__details"[\s\S]*onClick=\{onOpen\}/.test(cardMarkup)
      && /className="tvtime-watch-card__poster" onClick=\{onOpen\}/.test(cardMarkup)
      && /className="tvtime-watch-card__title" onClick=\{onOpen\}/.test(cardMarkup),
    "Watch and details actions keep their original handlers and pending safety",
  ],
  [
    /aspect-ratio: 2 \/ 3 !important;/.test(styles)
      && /\.tvtime-watch-card__poster img \{[\s\S]*object-fit: contain !important;[\s\S]*object-position: center !important;/.test(styles),
    "Series posters keep their complete 2:3 artwork without stretching or cropping",
  ],
  [
    /\.tvtime-watch-card-grid \{[\s\S]*width: 100%;[\s\S]*max-width: 100%;[\s\S]*min-width: 0;[\s\S]*minmax\(min\(100%, 25rem\), 1fr\)/.test(styles)
      && /\.tvtime-app \.tvtime-watch-card \{[\s\S]*max-width: 100%;[\s\S]*min-width: 0;[\s\S]*height: auto;[\s\S]*minmax\(0, 1fr\)/.test(styles),
    "Card grids remain bounded and shrink safely on phones and laptops",
  ],
  [
    !/\.tvtime-watch-card\s*>\s*:(?:first|last)-child/.test(styles)
      && !/\.tvtime-watch-card[^{]*\{[^}]*height:\s*100%/s.test(styles)
      && !/\.tvtime-watch-card__poster[^{]*\{[^}]*min-height:\s*100%/s.test(styles),
    "No late structural override can stretch the poster back to the card height",
  ],
  [
    /@media \(max-width: 767px\)[\s\S]*\.tvtime-app \.tvtime-watch-card \{[\s\S]*5\.25rem minmax\(0, 1fr\)/.test(styles)
      && /@media \(max-width: 359px\)[\s\S]*4\.7rem minmax\(0, 1fr\)/.test(styles),
    "Phone breakpoints preserve a compact poster column and a shrinkable information column",
  ],
  [
    /role="progressbar"/.test(view)
      && /aria-valuemin=\{0\}/.test(view)
      && /aria-valuemax=\{100\}/.test(view)
      && /aria-valuenow=\{progress\}/.test(view),
    "The visual redesign preserves accessible progress semantics",
  ],
];

let failed = 0;
for (const [condition, message] of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${message}`);
  if (!condition) failed += 1;
}

if (failed) process.exit(1);
console.log(`\nWatch Next series-card verification passed (${checks.length} checks).`);
