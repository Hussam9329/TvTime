import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageTitlebarProps = {
  title: ReactNode;
  className?: string;
};

/** Compact heading for top-level views already identified by the app header. */
export function PageTitlebar({ title, className }: PageTitlebarProps) {
  return (
    <header className={cn("tvtime-page-titlebar", className)}>
      <h1>{title}</h1>
    </header>
  );
}
