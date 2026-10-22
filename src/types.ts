export type Status = { id: string; label: string; short: string; color: string; order: number; visibleByDefault: boolean; pinStyle: 'solid' | 'outline' | 'muted' };
export type Project = {
  id: string; name: string; tagline?: string; status: string; type: 'villa' | 'apartment' | 'mixed'; zone: string;
  location: { lat: number; lng: number; locality: string; precision: string };
  possession?: string; config: string[]; sizes: { builtUpSft?: number[]; plotSqYd?: number[] };
  scale: { units?: number; unitLabel?: string; acres?: number; floors?: number };
  price?: { from: number | null; to?: number | null; label?: string; range?: string; note?: string; source?: { name: string; url: string; asOf: string } };
  approvals: { rera?: string; authority?: string }; highlights: string[];
  links: Partial<Record<'website' | 'websiteAlt' | 'video' | 'videoIntro' | 'brochure' | 'maps' | 'instagram' | 'facebook', string>>;
  media: { thumb?: string; hero?: string; pin?: string }; order: number;
  driveTimes: { id: string; name: string; time: string }[];
};
export type Zone = { id: string; label: string; order?: number; view?: { center: [number, number]; zoom: number }; outsideCity?: boolean; distanceNote?: string };
export type Brand = { contact?: { phone?: string; phoneDisplay?: string } };
export type Index = { statuses: Status[]; zones: Zone[]; projects: Project[]; brand: Brand };
