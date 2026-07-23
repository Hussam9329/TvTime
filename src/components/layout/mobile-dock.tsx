"use client";

import { Clapperboard, Compass, Film, Home, Play } from "lucide-react";

import { prefetchViewModule } from "@/lib/view-prefetch";
import { useNav, type ViewName } from "@/lib/store";
import { MOBILE_DOCK_VIEWS, isDetailView } from "@/lib/navigation-layout";
import { getViewLabel } from "@/lib/view-metadata";
import { cn } from "@/lib/utils";

type DockItem = {
  view: ViewName;
  icon: React.ElementType;
};

const dockIcons: Record<(typeof MOBILE_DOCK_VIEWS)[number], React.ElementType> = {
  home: Home,
  "watch-next": Play,
  discover: Compass,
  movies: Film,
  "tv-shows": Clapperboard,
};

const dockItems: DockItem[] = MOBILE_DOCK_VIEWS.map((view) => ({
  view,
  icon: dockIcons[view],
}));

export function MobileDock() {
  const view = useNav((state) => state.view);
  const setView = useNav((state) => state.setView);
  if (isDetailView(view)) return null;

  return (
    <nav className="tvtime-mobile-dock md:hidden" aria-label="Quick navigation">
      <div className="tvtime-mobile-dock__surface">
        {dockItems.map((item) => {
          const active = item.view === view;
          const label = getViewLabel(item.view);

          return (
            <button
              key={item.view}
              type="button"
              className={cn("tvtime-mobile-dock__item", active && "is-active")}
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              onClick={() => setView(item.view)}
              onFocus={() => prefetchViewModule(item.view)}
            >
              <span className="tvtime-mobile-dock__icon" aria-hidden="true">
                <item.icon />
              </span>
              <span className="tvtime-mobile-dock__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
