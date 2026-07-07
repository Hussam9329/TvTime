"use client";

import { img } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Play, ExternalLink } from "lucide-react";

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

interface WatchProvidersProps {
  providersData: any; // raw "watch/providers" response from TMDB
}

/**
 * Renders streaming availability (flatrate/rent/buy) for the current region.
 * TMDB watch/providers response shape:
 * { results: { US: { link, flatrate: [...], rent: [...], buy: [...], ads: [...] } } }
 */
export function WatchProviders({ providersData }: WatchProvidersProps) {
  const results = providersData?.results;
  if (!results) return null;

  // Pick a region: prefer US, then first available
  const region = results.US ? "US" : Object.keys(results)[0];
  if (!region) return null;
  const regionData = results[region];
  if (!regionData) return null;

  const flatrate: WatchProvider[] = regionData.flatrate ?? [];
  const rent: WatchProvider[] = regionData.rent ?? [];
  const buy: WatchProvider[] = regionData.buy ?? [];
  const ads: WatchProvider[] = regionData.ads ?? [];

  if (flatrate.length === 0 && rent.length === 0 && buy.length === 0 && ads.length === 0) {
    return null;
  }

  const link = regionData.link;
  const allProviders = [
    ...flatrate,
    ...ads,
  ];
  const uniqueProviders = Array.from(new Map(allProviders.map((p) => [p.provider_id, p])).values()).slice(0, 8);

  return (
    <Card className="p-4 glass">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2">
          <Play className="w-4 h-4 text-primary fill-primary" /> Where to Watch
        </h3>
        <Badge variant="secondary" className="text-[10px]">Region: {region}</Badge>
      </div>

      {uniqueProviders.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">Stream with subscription</p>
          <div className="flex flex-wrap gap-2">
            {uniqueProviders.map((p) => (
              <ProviderChip key={p.provider_id} provider={p} link={link} />
            ))}
          </div>
        </div>
      )}

      {(rent.length > 0 || buy.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {rent.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Rent</p>
              <div className="flex flex-wrap gap-1.5">
                {rent.slice(0, 5).map((p) => (
                  <ProviderChip key={p.provider_id} provider={p} link={link} small />
                ))}
              </div>
            </div>
          )}
          {buy.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Buy</p>
              <div className="flex flex-wrap gap-1.5">
                {buy.slice(0, 5).map((p) => (
                  <ProviderChip key={p.provider_id} provider={p} link={link} small />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
        >
          View on JustWatch <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </Card>
  );
}

function ProviderChip({ provider, link, small }: { provider: WatchProvider; link?: string; small?: boolean }) {
  const size = small ? "w-8 h-8" : "w-10 h-10";
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={provider.provider_name}
      className="group flex flex-col items-center gap-1"
    >
      <div className={`${size} rounded-md overflow-hidden bg-muted border border-border/40 group-hover:border-primary/60 transition-colors`}>
        {provider.logo_path ? (
          <img src={img(provider.logo_path, "w92")} alt={provider.provider_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-4 h-4" /></div>
        )}
      </div>
      {!small && (
        <span className="text-[9px] text-muted-foreground text-center line-clamp-1 max-w-[60px]">{provider.provider_name}</span>
      )}
    </a>
  );
}
