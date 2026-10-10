export type CategorySeed = { slug: string; name: string; children?: CategorySeed[] };

export const categorySeed: CategorySeed[] = [
  {
    slug: 'transport',
    name: 'Transport',
    children: [
      { slug: 'cars', name: 'Cars' },
      { slug: 'motorcycles', name: 'Motorcycles' },
      { slug: 'auto-parts', name: 'Auto parts' },
    ],
  },
  {
    slug: 'real-estate',
    name: 'Real estate',
    children: [
      { slug: 'apartments', name: 'Apartments' },
      { slug: 'houses', name: 'Houses' },
      { slug: 'rooms', name: 'Rooms' },
    ],
  },
  {
    slug: 'electronics',
    name: 'Electronics',
    children: [
      { slug: 'phones', name: 'Phones' },
      { slug: 'computers', name: 'Computers' },
      { slug: 'tv-audio', name: 'TV and audio' },
    ],
  },
  {
    slug: 'home-garden',
    name: 'Home and garden',
    children: [
      { slug: 'furniture', name: 'Furniture' },
      { slug: 'appliances', name: 'Appliances' },
      { slug: 'garden', name: 'Garden' },
    ],
  },
  {
    slug: 'fashion',
    name: 'Fashion',
    children: [
      { slug: 'clothing', name: 'Clothing' },
      { slug: 'shoes', name: 'Shoes' },
      { slug: 'accessories', name: 'Accessories' },
    ],
  },
  { slug: 'kids', name: 'Kids' },
  { slug: 'hobbies-sports', name: 'Hobbies and sports' },
  { slug: 'services', name: 'Services' },
  { slug: 'jobs', name: 'Jobs' },
  { slug: 'pets', name: 'Pets' },
];
