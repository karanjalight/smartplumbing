export type ProductCategory =
  | "Household"
  | "Repairs"
  | "Electronics"
  | "Towels & Clothes";

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  shortDescription: string;
  description: string;
  priceKes: number;
  stock: number;
  unit: string;
  imageUrl: string;
  galleryImages?: string[];
  rating: number;
  tags: string[];
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: "prod-001",
    slug: "microfiber-cleaning-kit",
    name: "Microfiber Cleaning Kit",
    category: "Household",
    shortDescription: "Set of lint-free cloths for kitchen and bathroom cleaning.",
    description:
      "Soft, durable microfiber cloths for daily cleaning around sinks, counters, mirrors, and appliances. Designed for homes that require quick wipe-downs between service visits.",
    priceKes: 750,
    stock: 48,
    unit: "pack",
    imageUrl:
      "https://images.pexels.com/photos/4239037/pexels-photo-4239037.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/4239037/pexels-photo-4239037.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4108714/pexels-photo-4108714.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4239091/pexels-photo-4239091.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.6,
    tags: ["cleaning", "kitchen", "bathroom"],
  },
  {
    id: "prod-002",
    slug: "chrome-faucet-head",
    name: "Chrome Faucet Head",
    category: "Repairs",
    shortDescription: "Universal replacement head for kitchen and bathroom taps.",
    description:
      "A universal faucet head with aerated flow and splash control. Useful for quick replacements when clients report worn-out tap nozzles.",
    priceKes: 1200,
    stock: 35,
    unit: "piece",
    imageUrl:
      "https://images.pexels.com/photos/7027855/pexels-photo-7027855.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/7027855/pexels-photo-7027855.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/5691633/pexels-photo-5691633.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/8486974/pexels-photo-8486974.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.7,
    tags: ["tap", "plumbing", "repair"],
  },
  {
    id: "prod-003",
    slug: "smart-energy-kettle",
    name: "Smart Energy Kettle",
    category: "Electronics",
    shortDescription: "Fast-boil kettle with auto shutoff and low-energy mode.",
    description:
      "Electric kettle with fast heating coil and temperature safety controls. Great for apartments and family homes that prioritize safety and utility efficiency.",
    priceKes: 3850,
    stock: 22,
    unit: "piece",
    imageUrl:
      "https://images.pexels.com/photos/7345447/pexels-photo-7345447.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/7345447/pexels-photo-7345447.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/5591663/pexels-photo-5591663.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/3944405/pexels-photo-3944405.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.4,
    tags: ["appliance", "kitchen", "electric"],
  },
  {
    id: "prod-004",
    slug: "bath-towel-set",
    name: "Cotton Bath Towel Set",
    category: "Towels & Clothes",
    shortDescription: "Absorbent cotton towels, ideal for short-term rentals.",
    description:
      "Premium cotton bath towels that dry quickly and hold softness after repeated washing. Ideal for tenants, guest units, and serviced apartments.",
    priceKes: 2150,
    stock: 40,
    unit: "set",
    imageUrl:
      "https://images.pexels.com/photos/6663465/pexels-photo-6663465.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/6663465/pexels-photo-6663465.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/5997992/pexels-photo-5997992.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.8,
    tags: ["bathroom", "linen", "hospitality"],
  },
  {
    id: "prod-005",
    slug: "multi-tool-repair-set",
    name: "Multi-Tool Repair Set",
    category: "Repairs",
    shortDescription: "Household toolkit for quick plumbing and utility fixes.",
    description:
      "A compact toolkit with screwdrivers, pliers, adjustable wrench, and tape measure. Built for routine apartment maintenance and emergency callouts.",
    priceKes: 3200,
    stock: 19,
    unit: "set",
    imageUrl:
      "https://images.pexels.com/photos/8985445/pexels-photo-8985445.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/8985445/pexels-photo-8985445.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/209235/pexels-photo-209235.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.5,
    tags: ["toolkit", "maintenance", "service"],
  },
  {
    id: "prod-006",
    slug: "led-emergency-lantern",
    name: "LED Emergency Lantern",
    category: "Electronics",
    shortDescription: "Rechargeable lantern for power outages and night repairs.",
    description:
      "Portable LED lantern with long battery life and USB recharge support. Useful for dark utility areas during evening inspections and outages.",
    priceKes: 2650,
    stock: 28,
    unit: "piece",
    imageUrl:
      "https://images.pexels.com/photos/7089010/pexels-photo-7089010.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/7089010/pexels-photo-7089010.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/1437511/pexels-photo-1437511.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/1304473/pexels-photo-1304473.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.3,
    tags: ["lighting", "backup", "safety"],
  },
  {
    id: "prod-007",
    slug: "heavy-duty-gloves",
    name: "Heavy Duty Service Gloves",
    category: "Repairs",
    shortDescription: "Protective gloves for plumbing and cleaning tasks.",
    description:
      "Rubberized, anti-slip gloves that protect hands during drain work, installations, and deep cleaning routines.",
    priceKes: 640,
    stock: 64,
    unit: "pair",
    imageUrl:
      "https://images.pexels.com/photos/6195125/pexels-photo-6195125.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/6195125/pexels-photo-6195125.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4491881/pexels-photo-4491881.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/6591154/pexels-photo-6591154.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.2,
    tags: ["safety", "protection", "tools"],
  },
  {
    id: "prod-008",
    slug: "laundry-basket-foldable",
    name: "Foldable Laundry Basket",
    category: "Household",
    shortDescription: "Space-saving laundry basket for apartment living.",
    description:
      "Lightweight foldable laundry basket with reinforced handles. A practical fit for compact homes and rental units with limited storage.",
    priceKes: 1450,
    stock: 31,
    unit: "piece",
    imageUrl:
      "https://images.pexels.com/photos/3952236/pexels-photo-3952236.jpeg?auto=compress&cs=tinysrgb&w=800",
    galleryImages: [
      "https://images.pexels.com/photos/3952236/pexels-photo-3952236.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4202926/pexels-photo-4202926.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/4621184/pexels-photo-4621184.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    rating: 4.4,
    tags: ["laundry", "storage", "home"],
  },
];

export function getProductBySlug(slug: string) {
  return SHOP_PRODUCTS.find((product) => product.slug === slug);
}
