import { useQuery } from '@tanstack/react-query';

export interface NavLink {
  label: string;
  url:   string;
  icon?: string;
}

export interface BrandingConfig {
  portalName:   string;
  logoUrl:      string | null;
  faviconUrl:   string | null;
  primaryColor: string | null;
  navLinks:     NavLink[];
}

const DEFAULTS: BrandingConfig = {
  portalName:   'ForgePortal',
  logoUrl:      null,
  faviconUrl:   null,
  primaryColor: null,
  navLinks:     [],
};

export function useBranding(): BrandingConfig {
  const { data } = useQuery<BrandingConfig>({
    queryKey:  ['branding'],
    queryFn:   () =>
      fetch('/api/v1/config/branding').then((r) => {
        if (!r.ok) throw new Error('branding fetch failed');
        return r.json() as Promise<BrandingConfig>;
      }),
    staleTime: 1000 * 60 * 10,  // 10 min — branding rarely changes
    gcTime:    1000 * 60 * 60,  // 1 hour
    retry:     false,
  });
  return data ?? DEFAULTS;
}
