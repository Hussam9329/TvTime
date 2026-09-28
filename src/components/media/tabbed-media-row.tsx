"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { MediaRow } from "@/components/media/media-row";
import type { MediaItem } from "@/lib/tmdb";

export interface MediaRowTab {
  value: string;
  label: string;
  items: MediaItem[];
  loading?: boolean;
  forcedMediaType?: "movie" | "tv";
}

type SharedRowProps = Pick<
  ComponentProps<typeof MediaRow>,
  "libraryStateSource" | "compactCards" | "onSeeAll" | "hint"
>;

interface TabbedMediaRowProps extends SharedRowProps {
  title: string;
  icon?: ReactNode;
  tabs: readonly MediaRowTab[];
}

/**
 * One shelf that groups related lists (Popular / Top rated / Upcoming…) behind
 * chip tabs, so Home shows one row per topic instead of one row per list.
 * Tabs that finished loading with nothing to show are dropped.
 */
export function TabbedMediaRow({ title, icon, tabs, ...rowProps }: TabbedMediaRowProps) {
  const visibleTabs = tabs.filter((tab) => tab.loading || tab.items.length > 0);
  const [selected, setSelected] = useState(tabs[0]?.value);
  const active = visibleTabs.find((tab) => tab.value === selected) ?? visibleTabs[0];

  if (!active) return null;

  return (
    <MediaRow
      {...rowProps}
      title={title}
      icon={icon}
      items={active.items}
      loading={active.loading}
      forcedMediaType={active.forcedMediaType}
      showCount={false}
      tabs={visibleTabs.map(({ value, label }) => ({ value, label }))}
      activeTab={active.value}
      onTabChange={setSelected}
    />
  );
}
