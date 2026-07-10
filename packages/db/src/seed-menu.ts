import { db } from "./index";
import { menuItems } from "./schema";

const REGULAR = "রেগুলার আইটেম (Regular Items)";
const BAKERY = "বেকারি আইটেম (Bekari Items)";

const items = [
  // Regular items
  { name: "Samosa", category: REGULAR, sortOrder: 1 },
  { name: "Singara", category: REGULAR, sortOrder: 2 },
  { name: "Roll", category: REGULAR, sortOrder: 3 },
  { name: "Kabab", category: REGULAR, sortOrder: 4 },
  { name: "Jal Patties", category: REGULAR, sortOrder: 5 },
  { name: "Dal Puri", category: REGULAR, sortOrder: 6 },
  { name: "Dim Paratha", category: REGULAR, sortOrder: 7 },
  { name: "Keema Paratha", category: REGULAR, sortOrder: 8 },
  { name: "Paratha", category: REGULAR, sortOrder: 9 },
  { name: "Piyaju", category: REGULAR, sortOrder: 10 },
  { name: "Anda Mithai", category: REGULAR, sortOrder: 11 },
  { name: "Onthon", category: REGULAR, sortOrder: 12 },
  { name: "Chaa", category: REGULAR, sortOrder: 13 },
  // Bakery items
  { name: "Jilapi", category: BAKERY, sortOrder: 14 },
  { name: "Bakarkhani", category: BAKERY, sortOrder: 15 },
  { name: "Danish", category: BAKERY, sortOrder: 16 },
  { name: "Butter Bun", category: BAKERY, sortOrder: 17 },
  { name: "Biscuit", category: BAKERY, sortOrder: 18 },
  { name: "Sandwich", category: BAKERY, sortOrder: 19 },
  { name: "Bun", category: BAKERY, sortOrder: 20 },
  { name: "Slice Cake", category: BAKERY, sortOrder: 21 },
  { name: "Cup Cake", category: BAKERY, sortOrder: 22 },
  { name: "Misti Pethi", category: BAKERY, sortOrder: 23 },
];

async function seedMenu() {
  const existing = await db.select().from(menuItems);
  if (existing.length > 0) {
    console.log(`Menu already has ${existing.length} items. Skipping.`);
    process.exit(0);
  }

  const now = new Date();
  const rows = items.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    price: 10,
    category: item.category,
    imageUrl: null,
    isAvailable: true,
    sortOrder: item.sortOrder,
    createdAt: now,
  }));

  await db.insert(menuItems).values(rows);
  console.log(`Seeded ${rows.length} menu items.`);

  process.exit(0);
}

seedMenu().catch((err) => {
  console.error(err);
  process.exit(1);
});
