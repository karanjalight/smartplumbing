/**
 * Curated stock photography for the marketing landing page.
 *
 * All images are served from `images.pexels.com` (already whitelisted in
 * `next.config.ts`). Each entry includes width / height / `alt` so the
 * Next.js <Image> component can lay them out without layout shift.
 *
 * Image sources: hand-picked free Pexels stock photos. Replace any URL
 * here to swap imagery across the whole site without touching component
 * code.
 */

export type MarketingImage = {
  /** Direct Pexels URL with sizing params. */
  src: string;
  /** Width in pixels of the source variant we request. */
  width: number;
  /** Height in pixels of the source variant we request. */
  height: number;
  /** Accessible description for assistive technology. */
  alt: string;
};

function pexels(id: number, w: number, h: number, alt: string): MarketingImage {
  // `auto=compress&cs=tinysrgb` is Pexels' recommended performant variant.
  // `fit=crop` ensures we get the exact aspect ratio we asked for.
  return {
    src: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    width: w,
    height: h,
    alt,
  };
}

/* ------------------------------------------------------------------ */
/* People · square avatars used in the hero "trusted by" strip         */
/* ------------------------------------------------------------------ */

export const HERO_AVATARS: MarketingImage[] = [
  pexels(3760854, 128, 128, "Smiling resident in Karen, Nairobi"),
  pexels(2379004, 128, 128, "Landlord using Mali Smart for his portfolio"),
  pexels(
    3769021,
    128,
    128,
    "Property operations lead reviewing the dashboard"
  ),
  pexels(
    29387556,
    128,
    128,
    "Young African business professional on Mali Smart"
  ),
  pexels(
    2364447,
    128,
    128,
    "Tenant paying rent on the Mali Smart app"
  ),
];

/* ------------------------------------------------------------------ */
/* Testimonials · landlord / agency / tenant headshots                */
/* ------------------------------------------------------------------ */

export type Testimonial = {
  quote: string;
  name: string;
  title: string;
  photo: MarketingImage;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We retired four spreadsheets in the first week. Rent settles to our M-Pesa by 10am every payout day — without anyone calling tenants.",
    name: "Wanjiru Mwaura",
    title: "Operations Lead · Karen Properties",
    photo: pexels(
      3769021,
      240,
      240,
      "Wanjiru Mwaura, Operations Lead at Karen Properties"
    ),
  },
  {
    quote:
      "Water disputes basically disappeared. Tenants buy tokens on their phone in seconds, and we get one clean statement at month-end. Worth every shilling.",
    name: "Brian Otieno",
    title: "Landlord · Lavington",
    photo: pexels(
      2379004,
      240,
      240,
      "Brian Otieno, Mali Smart landlord client in Lavington"
    ),
  },
  {
    quote:
      "I pay rent and buy water from one app while I commute. When my kitchen tap leaked, a plumber arrived in 90 minutes. This is how a house should run.",
    name: "Mukami Wairimu",
    title: "Resident · Karen Springs",
    photo: pexels(
      3760854,
      240,
      240,
      "Mukami Wairimu, resident at Karen Springs"
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Property gallery · residential buildings                            */
/* ------------------------------------------------------------------ */

export type PropertyPhoto = {
  image: MarketingImage;
  name: string;
  meta: string;
};

export const PROPERTY_GALLERY: PropertyPhoto[] = [
  {
    image: pexels(
      28764706,
      720,
      900,
      "Karen Springs residential apartment block"
    ),
    name: "Karen Springs",
    meta: "96 units · Karen, Nairobi",
  },
  {
    image: pexels(
      29750117,
      720,
      900,
      "Riverside Mews modern apartment exterior"
    ),
    name: "Riverside Mews",
    meta: "72 units · Westlands, Nairobi",
  },
  {
    image: pexels(
      6084201,
      720,
      900,
      "Tatu Heights contemporary residential building"
    ),
    name: "Tatu Heights",
    meta: "120 units · Ruiru",
  },
  {
    image: pexels(
      29887755,
      720,
      900,
      "Lavington Court high-rise apartments at dusk"
    ),
    name: "Lavington Court",
    meta: "48 units · Lavington, Nairobi",
  },
];

/* ------------------------------------------------------------------ */
/* Lifestyle photo · person holding a phone (tenant-experience banner) */
/* ------------------------------------------------------------------ */

export const TENANT_LIFESTYLE_IMAGE: MarketingImage = pexels(
  2364447,
  900,
  1100,
  "Tenant on the Mali Smart app at home"
);

/** Book-a-demo page · left-panel lifestyle photo */
export const DEMO_BOOKING_IMAGE: MarketingImage = pexels(
  3769021,
  1200,
  1600,
  "Property operations lead reviewing a portfolio walkthrough on Mali Smart"
);

/* ------------------------------------------------------------------ */
/* Sub-page hero backgrounds (wide, cinematic, ~1600×900)              */
/* ------------------------------------------------------------------ */

/**
 * Plumbing-first hero photography:
 *   - platform  → copper plumbing fittings (the literal infrastructure)
 *   - metering  → stainless pipes with pressure gauges
 *   - residents → modern bathroom & fixtures (the water tenants pay for)
 *   - operators → hand turning a metal pipe (the operator's craft)
 *   - trust     → vintage pressure gauges (audited, measured, robust)
 *
 * Each photo is fetched at 1600×900 (16:9) so we have enough resolution
 * for retina displays without being wasteful. The dark scrim applied in
 * <PageHero> guarantees text contrast regardless of subject.
 */
export const PAGE_HERO_IMAGES = {
  platform: pexels(
    28169591,
    1600,
    900,
    "Copper plumbing fittings — the infrastructure Mali Smart automates"
  ),
  metering: pexels(
    372796,
    1600,
    900,
    "Stainless steel water pipes with pressure gauges in an industrial setting"
  ),
  residents: pexels(
    6585753,
    1600,
    900,
    "Modern bathroom interior — the water experience Mali Smart meters"
  ),
  operators: pexels(
    10246156,
    1600,
    900,
    "Hand adjusting a metal water pipe — operators keeping the building running"
  ),
  trust: pexels(
    5013562,
    1600,
    900,
    "Analog pressure gauges on a brick wall — measured, audited infrastructure"
  ),
} as const;

export type PageHeroKey = keyof typeof PAGE_HERO_IMAGES;
