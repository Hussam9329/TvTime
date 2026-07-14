"use client";

import { img } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Play, ExternalLink, Star } from "lucide-react";
import { getUserPreferences } from "@/lib/user-preferences";
import { SafeImage } from "@/components/media/safe-image";

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
 * Renders streaming availability (flatrate/rent/buy) for the user's region.
 * TVM-36: Uses user's country preference (default IQ) instead of hardcoded US.
 * TVM-37: Highlights preferred platforms.
 * TMDB watch/providers response shape:
 * { results: { IQ: { link, flatrate: [...], rent: [...], buy: [...], ads: [...] } } }
 */
export function WatchProviders({ providersData }: WatchProvidersProps) {
  const results = providersData?.results;
  if (!results) return null;

  // TVM-36: Use user's country preference, fallback to US, then first available
  const prefs = getUserPreferences();
  const region = results[prefs.country] ? prefs.country : (results.US ? "US" : Object.keys(results)[0]);
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

  // TVM-37: Mark preferred platforms
  const isPreferred = (p: WatchProvider) => prefs.preferredPlatforms.includes(p.provider_name);

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
              <ProviderChip key={p.provider_id} provider={p} link={link} preferred={isPreferred(p)} />
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
                  <ProviderChip key={p.provider_id} provider={p} link={link} small preferred={isPreferred(p)} />
                ))}
              </div>
            </div>
          )}
          {buy.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Buy</p>
              <div className="flex flex-wrap gap-1.5">
                {buy.slice(0, 5).map((p) => (
                  <ProviderChip key={p.provider_id} provider={p} link={link} small preferred={isPreferred(p)} />
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

function ProviderChip({ provider, link, small, preferred }: { provider: WatchProvider; link?: string; small?: boolean; preferred?: boolean }) {
  const size = small ? "w-8 h-8" : "w-10 h-10";
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={provider.provider_name + (preferred ? " ★ Preferred" : "")}
      className="group flex flex-col items-center gap-1 relative"
    >
      {/* TVM-37: Star indicator for preferred platforms */}
      {preferred && (
        <div className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
          <Star className="w-2.5 h-2.5 text-black fill-black" />
        </div>
      )}
      <div className={`relative ${size} rounded-md overflow-hidden bg-muted border border-border/40 group-hover:border-primary/60 transition-colors ${preferred ? "ring-2 ring-amber-400/50" : ""}`}>
        {provider.logo_path ? (
          <SafeImage src={img(provider.logo_path, "w92")} alt={provider.provider_name} fill variant="logo" />
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
