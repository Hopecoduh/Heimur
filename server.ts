import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("game.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT,
    display_name TEXT
  );

  CREATE TABLE IF NOT EXISTS player_skills (
    player_id INTEGER,
    skill_type TEXT, -- 'wood', 'mining', 'animal', 'plants'
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, skill_type),
    FOREIGN KEY(player_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    gold INTEGER DEFAULT 100,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    rank_letter TEXT DEFAULT 'F',
    rank_level INTEGER DEFAULT 1,
    adventure_xp INTEGER DEFAULT 0,
    completed_adventures INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    guild_class INTEGER DEFAULT 12,
    leader_id INTEGER,
    FOREIGN KEY(leader_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS guild_members (
    guild_id INTEGER,
    player_id INTEGER UNIQUE,
    PRIMARY KEY(guild_id, player_id),
    FOREIGN KEY(guild_id) REFERENCES guilds(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT, -- 'material' or 'product'
    category TEXT, -- 'wood', 'metal', 'food', 'gear', 'medicine', etc.
    rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
    tier TEXT DEFAULT 'F', -- 'F', 'D', 'C', 'B', 'A', 'S'
    damage INTEGER DEFAULT 0,
    stat_value INTEGER DEFAULT 0, -- For food/medicine stats
    base_price INTEGER
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    skill_type TEXT DEFAULT 'crafting', -- 'crafting' or 'cooking'
    duration_seconds INTEGER,
    min_skill_level INTEGER DEFAULT 1,
    success_rate INTEGER DEFAULT 100, -- Base percentage
    xp_reward INTEGER DEFAULT 10,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    recipe_id INTEGER,
    item_id INTEGER, -- material id
    quantity INTEGER,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    player_id INTEGER,
    item_id INTEGER,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, item_id),
    FOREIGN KEY(player_id) REFERENCES players(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS active_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    task_type TEXT, -- 'crafting', 'gathering', 'adventure'
    target_id INTEGER, -- recipe_id, gathering_zone_id, or adventure_template_id
    extra_data TEXT, -- JSON for tier, monster, etc.
    start_time INTEGER, -- timestamp
    end_time INTEGER, -- timestamp
    FOREIGN KEY(player_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS monsters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    tier TEXT -- 'F', 'D', 'C', 'B', 'A', 'S'
  );

  CREATE TABLE IF NOT EXISTS adventure_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    type TEXT -- 'hunt', 'resource', 'escort', 'dungeon', 'exploration', 'contract'
  );

  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    last_refresh INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS shop_stock (
    shop_id INTEGER,
    item_id INTEGER,
    quantity INTEGER,
    price INTEGER,
    PRIMARY KEY(shop_id, item_id),
    FOREIGN KEY(shop_id) REFERENCES shops(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  );
`);

try {
  db.exec("ALTER TABLE active_tasks ADD COLUMN extra_data TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE items ADD COLUMN rarity TEXT DEFAULT 'common'");
} catch (e) {}
try {
  db.exec("ALTER TABLE items ADD COLUMN tier TEXT DEFAULT 'F'");
} catch (e) {}
try {
  db.exec("ALTER TABLE recipes ADD COLUMN skill_type TEXT DEFAULT 'crafting'");
} catch (e) {}
try {
  db.exec("ALTER TABLE items ADD COLUMN stat_value INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE recipes ADD COLUMN min_skill_level INTEGER DEFAULT 1");
} catch (e) {}
try {
  db.exec("ALTER TABLE recipes ADD COLUMN success_rate INTEGER DEFAULT 100");
} catch (e) {}
try {
  db.exec("ALTER TABLE recipes ADD COLUMN xp_reward INTEGER DEFAULT 10");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN rank_letter TEXT DEFAULT 'F'");
} catch (e) {}
try {
  db.exec("ALTER TABLE players ADD COLUMN rank_level INTEGER DEFAULT 1");
} catch (e) {}
try {
  db.exec("ALTER TABLE players ADD COLUMN adventure_xp INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE players ADD COLUMN completed_adventures INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE players ADD COLUMN last_adventure_claim INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE shops ADD COLUMN last_refresh INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

// Seed initial data if empty or outdated
const woodLogCheck = db.prepare("SELECT COUNT(*) as count FROM items WHERE name = 'Stick Bundle'").get() as any;
const shopCheck = db.prepare("SELECT COUNT(*) as count FROM shops").get() as any;
const recipeCheck = db.prepare("SELECT COUNT(*) as count FROM recipes").get() as any;

if (woodLogCheck.count === 0 || shopCheck.count === 0 || recipeCheck.count === 0) {
  console.log("Seeding database...");
  // Clear old data to ensure new categories and items are correctly populated
  db.exec("DELETE FROM recipe_ingredients; DELETE FROM recipes; DELETE FROM inventory; DELETE FROM shop_stock; DELETE FROM shops; DELETE FROM items; DELETE FROM monsters; DELETE FROM adventure_templates;");
  
    const insertItem = db.prepare("INSERT INTO items (name, type, category, rarity, tier, damage, stat_value, base_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    // --- MATERIALS (Gatherable) ---
    // WOOD
    insertItem.run("Common Wood", "material", "wood", "common", "F", 0, 0, 5);
    insertItem.run("Oak Wood", "material", "wood", "rare", "D", 0, 0, 15);
    insertItem.run("Rosewood", "material", "wood", "epic", "C", 0, 0, 50);
    insertItem.run("Stick", "material", "wood", "common", "F", 0, 0, 2);

    // MINING
    insertItem.run("Stone", "material", "mining", "common", "F", 0, 0, 3);
    insertItem.run("Flint", "material", "mining", "common", "F", 0, 0, 4);
    insertItem.run("Coal", "material", "mining", "common", "F", 0, 0, 8);
    insertItem.run("Copper Ore", "material", "mining", "common", "F", 0, 0, 12);
    insertItem.run("Tin Ore", "material", "mining", "common", "F", 0, 0, 12);
    insertItem.run("Iron Ore", "material", "mining", "rare", "D", 0, 0, 20);
    insertItem.run("Silver Ore", "material", "mining", "epic", "C", 0, 0, 40);
    insertItem.run("Gold Ore", "material", "mining", "legendary", "B", 0, 0, 80);

    // ANIMAL
    insertItem.run("Raw Meat", "material", "animal", "common", "F", 0, 0, 10);
    insertItem.run("Raw Fish", "material", "animal", "common", "F", 0, 0, 8);
    insertItem.run("Hide", "material", "animal", "common", "F", 0, 0, 15);
    insertItem.run("Bone", "material", "animal", "common", "F", 0, 0, 5);
    insertItem.run("Feather", "material", "animal", "common", "F", 0, 0, 4);
    insertItem.run("Wool", "material", "animal", "common", "F", 0, 0, 12);
    insertItem.run("Milk", "material", "animal", "common", "F", 0, 0, 6);
    insertItem.run("Egg", "material", "animal", "common", "F", 0, 0, 3);

    // PLANTS
    insertItem.run("Wheat", "material", "plants", "common", "F", 0, 0, 4);
    insertItem.run("Corn", "material", "plants", "common", "F", 0, 0, 5);
    insertItem.run("Carrot", "material", "plants", "common", "F", 0, 0, 6);
    insertItem.run("Potato", "material", "plants", "common", "F", 0, 0, 6);
    insertItem.run("Berry", "material", "plants", "common", "F", 0, 0, 3);
    insertItem.run("Herbs", "material", "plants", "common", "F", 0, 0, 10);
    insertItem.run("Cotton", "material", "plants", "common", "F", 0, 0, 15);
    insertItem.run("Sugarcane", "material", "plants", "common", "F", 0, 0, 12);
    insertItem.run("Plant Matter", "material", "plants", "common", "F", 0, 0, 2);
    insertItem.run("Fiber", "material", "plants", "common", "F", 0, 0, 4);

    // --- PRODUCTS (Craftable) ---
    // BASIC GOODS
    insertItem.run("Stick Bundle", "product", "basic", "common", "F", 0, 0, 10);
    insertItem.run("Plank Board", "product", "basic", "common", "F", 0, 0, 20);
    insertItem.run("Stone Brick", "product", "basic", "common", "F", 0, 0, 15);
    insertItem.run("Glass Bottle", "product", "basic", "common", "F", 0, 0, 25);
    insertItem.run("Rope", "product", "basic", "common", "F", 0, 0, 15);
    insertItem.run("Cloth", "product", "basic", "common", "F", 0, 0, 30);
    insertItem.run("Leather", "product", "basic", "common", "F", 0, 0, 45);
    insertItem.run("Leather Strips", "product", "basic", "common", "F", 0, 0, 15);
    insertItem.run("Flour", "product", "basic", "common", "F", 0, 0, 12);
    insertItem.run("Sugar", "product", "basic", "common", "F", 0, 0, 25);

    // INGOTS
    insertItem.run("Copper Ingot", "product", "ingot", "common", "F", 0, 0, 40);
    insertItem.run("Tin Ingot", "product", "ingot", "common", "F", 0, 0, 40);
    insertItem.run("Bronze Ingot", "product", "ingot", "rare", "D", 0, 0, 100);
    insertItem.run("Iron Ingot", "product", "ingot", "rare", "D", 0, 0, 80);
    insertItem.run("Steel Ingot", "product", "ingot", "epic", "C", 0, 0, 150);
    insertItem.run("Silver Ingot", "product", "ingot", "epic", "C", 0, 0, 120);
    insertItem.run("Gold Ingot", "product", "ingot", "legendary", "B", 0, 0, 250);

    // WEAPONS & GEAR
    // F Tier
    insertItem.run("Training Sword", "product", "gear", "common", "F", 5, 0, 50);
    insertItem.run("Wooden Shield", "product", "gear", "common", "F", 2, 0, 40);
    
    // D Tier
    insertItem.run("Bronze Sword", "product", "gear", "rare", "D", 15, 0, 300);
    insertItem.run("Bronze Shield", "product", "gear", "rare", "D", 8, 0, 250);
    
    // C Tier
    insertItem.run("Iron Sword", "product", "gear", "epic", "C", 35, 0, 700);
    insertItem.run("Iron Shield", "product", "gear", "epic", "C", 20, 600);
    
    // B Tier
    insertItem.run("Steel Sword", "product", "gear", "legendary", "B", 75, 0, 1800);
    insertItem.run("Steel Shield", "product", "gear", "legendary", "B", 45, 0, 1500);
    
    // A Tier
    insertItem.run("Mythril Blade", "product", "gear", "legendary", "A", 150, 0, 5000);
    insertItem.run("Mythril Aegis", "product", "gear", "legendary", "A", 100, 0, 4500);

    // S Tier
    insertItem.run("Divine Avenger", "product", "gear", "legendary", "S", 350, 0, 25000);
    insertItem.run("Aegis of the Gods", "product", "gear", "legendary", "S", 250, 0, 20000);

    // FOOD
    insertItem.run("Cooked Meat", "product", "food", "common", "F", 0, 25, 25);
    insertItem.run("Cooked Fish", "product", "food", "common", "F", 0, 20, 20);
    insertItem.run("Berry Jam", "product", "food", "common", "F", 0, 30, 30);
    insertItem.run("Bread", "product", "food", "common", "F", 0, 20, 20);
    insertItem.run("Vegetable Soup", "product", "food", "rare", "D", 0, 45, 45);
    insertItem.run("Meat Stew", "product", "food", "rare", "D", 0, 60, 60);
    insertItem.run("Meat Pie", "product", "food", "epic", "C", 0, 80, 80);
    insertItem.run("Milk Bottle", "product", "food", "common", "F", 0, 40, 40);
    insertItem.run("Water Bottle", "product", "food", "common", "F", 0, 15, 15);
    insertItem.run("Juice", "product", "food", "common", "F", 0, 35, 35);
    insertItem.run("Ale", "product", "food", "common", "F", 0, 50, 50);

    // RANKED FOOD
    insertItem.run("Gourmet Steak", "product", "food", "rare", "D", 0, 120, 150);
    insertItem.run("Royal Feast", "product", "food", "epic", "B", 0, 350, 500);
    insertItem.run("Ambrosia", "product", "food", "legendary", "S", 0, 1000, 2500);

    // TRADE GOODS
    insertItem.run("Simple Jewelry", "product", "trade", "rare", "D", 0, 0, 500);
    insertItem.run("Fine Jewelry", "product", "trade", "epic", "C", 0, 0, 1500);

    // MEDICINE
    insertItem.run("Simple Medicine", "product", "medicine", "common", "F", 0, 50, 100);
    insertItem.run("Strong Medicine", "product", "medicine", "rare", "D", 0, 150, 300);

    // --- RECIPES ---
    const insertRecipe = db.prepare("INSERT INTO recipes (item_id, skill_type, duration_seconds, min_skill_level, success_rate, xp_reward) VALUES (?, ?, ?, ?, ?, ?)");
    const insertIngredient = db.prepare("INSERT INTO recipe_ingredients (recipe_id, item_id, quantity) VALUES (?, ?, ?)");
    
    const getItemId = (name: string) => (db.prepare("SELECT id FROM items WHERE name = ?").get(name) as any).id;

    // Helper to add recipe
    const addRecipe = (itemName: string, duration: number, ingredients: [string, number][], minSkill = 1, success = 100, xp = 10, skillType = 'crafting') => {
      const itemId = getItemId(itemName);
      const recipeId = insertRecipe.run(itemId, skillType, duration, minSkill, success, xp).lastInsertRowid;
      for (const [ingName, qty] of ingredients) {
        insertIngredient.run(recipeId, getItemId(ingName), qty);
      }
    };

  // Basic Goods
  addRecipe("Stick Bundle", 5, [["Stick", 5]], 1, 100, 5);
  addRecipe("Plank Board", 10, [["Common Wood", 2]], 1, 100, 8);
  addRecipe("Stone Brick", 8, [["Stone", 3]], 1, 100, 8);
  addRecipe("Glass Bottle", 12, [["Stone", 2], ["Coal", 1]], 2, 100, 12);
  addRecipe("Rope", 6, [["Fiber", 5]], 1, 100, 5);
  addRecipe("Cloth", 10, [["Cotton", 3]], 3, 100, 15);
  addRecipe("Leather", 15, [["Hide", 2]], 4, 100, 20);
  addRecipe("Leather Strips", 5, [["Leather", 1]], 2, 100, 5);
  addRecipe("Flour", 8, [["Wheat", 3]], 1, 100, 5);
  addRecipe("Sugar", 10, [["Sugarcane", 2]], 2, 100, 10);

  // Ingots
  addRecipe("Copper Ingot", 15, [["Copper Ore", 3], ["Coal", 1]], 5, 100, 20);
  addRecipe("Tin Ingot", 15, [["Tin Ore", 3], ["Coal", 1]], 5, 100, 20);
  addRecipe("Bronze Ingot", 25, [["Copper Ingot", 2], ["Tin Ingot", 1]], 10, 95, 40);
  addRecipe("Iron Ingot", 20, [["Iron Ore", 3], ["Coal", 2]], 15, 90, 60);
  addRecipe("Steel Ingot", 40, [["Iron Ingot", 1], ["Coal", 4]], 30, 85, 120);
  addRecipe("Silver Ingot", 30, [["Silver Ore", 3], ["Coal", 2]], 25, 90, 100);
  addRecipe("Gold Ingot", 60, [["Gold Ore", 3], ["Coal", 3]], 40, 80, 250);

  // Gear - Tiers
  // F Tier (100% success, min skill 1)
  addRecipe("Training Sword", 30, [["Stick Bundle", 2], ["Stone", 2]], 1, 100, 20);
  addRecipe("Wooden Shield", 25, [["Plank Board", 2], ["Stick", 2]], 1, 100, 15);
  
  // D Tier (90% success, min skill 10)
  addRecipe("Bronze Sword", 90, [["Bronze Ingot", 5], ["Leather Strips", 2]], 10, 90, 80);
  addRecipe("Bronze Shield", 80, [["Bronze Ingot", 4], ["Plank Board", 2]], 10, 90, 70);
  
  // C Tier (80% success, min skill 25)
  addRecipe("Iron Sword", 150, [["Iron Ingot", 6], ["Leather Strips", 3]], 25, 80, 200);
  addRecipe("Iron Shield", 130, [["Iron Ingot", 5], ["Plank Board", 3]], 25, 80, 180);
  
  // B Tier (70% success, min skill 45)
  addRecipe("Steel Sword", 300, [["Steel Ingot", 8], ["Leather Strips", 5]], 45, 70, 500);
  addRecipe("Steel Shield", 280, [["Steel Ingot", 7], ["Plank Board", 5]], 45, 70, 450);
  
  // A Tier (60% success, min skill 70)
  addRecipe("Mythril Blade", 600, [["Gold Ingot", 5], ["Silver Ingot", 10], ["Rosewood", 5]], 70, 60, 1500);
  addRecipe("Mythril Aegis", 550, [["Gold Ingot", 4], ["Silver Ingot", 8], ["Rosewood", 5]], 70, 60, 1200);

  // S Tier (50% success, min skill 95)
  addRecipe("Divine Avenger", 1200, [["Gold Ingot", 20], ["Silver Ingot", 20], ["Rosewood", 10]], 95, 50, 5000);
  addRecipe("Aegis of the Gods", 1100, [["Gold Ingot", 15], ["Silver Ingot", 15], ["Rosewood", 10]], 95, 50, 4500);

  // Food (Cooking Skill)
  addRecipe("Cooked Meat", 10, [["Raw Meat", 1], ["Coal", 1]], 1, 100, 10, 'cooking');
  addRecipe("Cooked Fish", 10, [["Raw Fish", 1], ["Coal", 1]], 1, 100, 10, 'cooking');
  addRecipe("Berry Jam", 15, [["Berry", 5], ["Sugar", 1], ["Glass Bottle", 1]], 3, 100, 15, 'cooking');
  addRecipe("Bread", 12, [["Flour", 2], ["Milk", 1]], 5, 100, 15, 'cooking');
  addRecipe("Vegetable Soup", 20, [["Potato", 2], ["Carrot", 2], ["Water Bottle", 1]], 10, 95, 25, 'cooking');
  addRecipe("Meat Stew", 25, [["Raw Meat", 2], ["Potato", 2], ["Water Bottle", 1]], 15, 90, 35, 'cooking');
  addRecipe("Meat Pie", 35, [["Raw Meat", 2], ["Flour", 2], ["Egg", 2]], 25, 85, 50, 'cooking');
  addRecipe("Milk Bottle", 5, [["Milk", 1], ["Glass Bottle", 1]], 1, 100, 5, 'cooking');
  addRecipe("Water Bottle", 5, [["Glass Bottle", 1]], 1, 100, 2, 'cooking');
  addRecipe("Juice", 15, [["Berry", 5], ["Sugar", 1], ["Glass Bottle", 1]], 5, 100, 15, 'cooking');
  addRecipe("Ale", 30, [["Wheat", 5], ["Sugarcane", 2], ["Glass Bottle", 1]], 15, 90, 40, 'cooking');

  // Gourmet Food
  addRecipe("Gourmet Steak", 60, [["Raw Meat", 3], ["Herbs", 2], ["Coal", 2]], 40, 80, 150, 'cooking');
  addRecipe("Royal Feast", 180, [["Raw Meat", 5], ["Raw Fish", 5], ["Vegetable Soup", 2], ["Ale", 2]], 70, 65, 600, 'cooking');
  addRecipe("Ambrosia", 600, [["Royal Feast", 1], ["Berry Jam", 5], ["Milk Bottle", 5], ["Gold Ore", 1]], 95, 45, 2500, 'cooking');

  // Trade
  addRecipe("Simple Jewelry", 120, [["Silver Ingot", 1], ["Gold Ingot", 1]]);
  addRecipe("Fine Jewelry", 300, [["Gold Ingot", 3], ["Silver Ingot", 2]]);

  // Medicine Recipes
  addRecipe("Simple Medicine", 30, [["Herbs", 5], ["Glass Bottle", 1]]);
  addRecipe("Strong Medicine", 60, [["Herbs", 10], ["Berry", 5], ["Glass Bottle", 1]]);

  const insertShop = db.prepare("INSERT INTO shops (name, category, last_refresh) VALUES (?, ?, ?)");
  insertShop.run("The Woodcutter", "wood", Date.now());
  insertShop.run("Blacksmith", "mining", Date.now());
  insertShop.run("Bakery", "plants", Date.now());
  insertShop.run("Trapper's Lodge", "animal", Date.now());
  insertShop.run("General Store", "basic", Date.now());
  insertShop.run("Apothecary", "medicine", Date.now());

  // --- MONSTERS ---
  const insertMonster = db.prepare("INSERT INTO monsters (name, tier) VALUES (?, ?)");
  // F Tier
  insertMonster.run("Forest Slime", "F");
  insertMonster.run("Wild Boar", "F");
  insertMonster.run("Cave Rat", "F");
  insertMonster.run("Stray Wolf", "F");
  insertMonster.run("Bandit Scout", "F");
  // D Tier
  insertMonster.run("Dire Wolf", "D");
  insertMonster.run("Goblin Raider", "D");
  insertMonster.run("Skeleton Soldier", "D");
  insertMonster.run("Swamp Serpent", "D");
  insertMonster.run("Rogue Mercenary", "D");
  // C Tier
  insertMonster.run("Orc Warrior", "C");
  insertMonster.run("Troll Brute", "C");
  insertMonster.run("Shadow Stalker", "C");
  insertMonster.run("Fire Imp", "C");
  insertMonster.run("Undead Knight", "C");
  // B Tier
  insertMonster.run("Ogre Warlord", "B");
  insertMonster.run("Dark Mage", "B");
  insertMonster.run("Frost Giant", "B");
  insertMonster.run("Stone Golem", "B");
  insertMonster.run("Assassin Captain", "B");
  // A Tier
  insertMonster.run("Ancient Wyvern", "A");
  insertMonster.run("Arch Lich", "A");
  insertMonster.run("Demon General", "A");
  insertMonster.run("Titan Guardian", "A");
  insertMonster.run("Void Reaper", "A");
  // S Tier
  insertMonster.run("Dragon Sovereign", "S");
  insertMonster.run("Abyssal Leviathan", "S");
  insertMonster.run("Fallen Seraph", "S");
  insertMonster.run("World Devourer", "S");
  insertMonster.run("Chaos Overlord", "S");

  // --- ADVENTURE TEMPLATES ---
  const insertTemplate = db.prepare("INSERT INTO adventure_templates (name, description, type) VALUES (?, ?, ?)");
  insertTemplate.run("Monster Hunt", "Defeat a specific monster threatening the region.", "hunt");
  insertTemplate.run("Resource Expedition", "Gather rare materials from dangerous territories.", "resource");
  insertTemplate.run("Escort Mission", "Protect a merchant caravan through hostile lands.", "escort");
  insertTemplate.run("Dungeon Raid", "A multi-phase encounter deep within ancient ruins.", "dungeon");
  insertTemplate.run("Exploration", "Venture into the unknown for rare discoveries.", "exploration");
  insertTemplate.run("Guild Contract", "High-prestige competitive contract for guild promotion.", "contract");

  const shops = db.prepare("SELECT * FROM shops").all() as any[];
  const insertStock = db.prepare("INSERT INTO shop_stock (shop_id, item_id, quantity, price) VALUES (?, ?, ?, ?)");
  
  for (const shop of shops) {
    const items = db.prepare("SELECT * FROM items WHERE category = ?").all(shop.category) as any[];
    for (const item of items) {
      insertStock.run(shop.id, item.id, 50, Math.floor(item.base_price * 1.2));
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Middleware: Auth
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify user still exists in DB (prevents issues with stale tokens after DB resets)
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.id);
      if (!user) {
        return res.status(401).json({ error: "Session expired" });
      }
      
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const requirePlayer = (req: any, res: any, next: any) => {
    let player = db.prepare(`
      SELECT p.*, u.username, u.email, u.display_name 
      FROM players p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.user_id = ?
    `).get(req.user.id) as any;
    
    // Self-healing: Create player profile if it somehow went missing
    if (!player) {
      try {
        db.prepare("INSERT INTO players (user_id) VALUES (?)").run(req.user.id);
        player = db.prepare(`
          SELECT p.*, u.username, u.email, u.display_name 
          FROM players p 
          JOIN users u ON p.user_id = u.id 
          WHERE p.user_id = ?
        `).get(req.user.id) as any;
      } catch (err: any) {
        console.error("Player creation error:", err);
        return res.status(500).json({ error: `Failed to create player profile: ${err.message}` });
      }
    }
    
    if (!player) return res.status(404).json({ error: "Player profile not found" });

    // Initialize skills if missing
    const categories = ["wood", "mining", "animal", "plants", "crafting", "cooking"];
    for (const cat of categories) {
      const skill = db.prepare("SELECT * FROM player_skills WHERE player_id = ? AND skill_type = ?").get(player.id, cat);
      if (!skill) {
        db.prepare("INSERT INTO player_skills (player_id, skill_type) VALUES (?, ?)").run(player.id, cat);
      }
    }

    const skills = db.prepare("SELECT * FROM player_skills WHERE player_id = ?").all(player.id);
    player.skills = skills;

    req.player = player;
    next();
  };

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    const registerTx = db.transaction((user, pass) => {
      const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(user, pass);
      db.prepare("INSERT INTO players (user_id) VALUES (?)").run(result.lastInsertRowid);
      return true;
    });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      registerTx(username, hashedPassword);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: "Username already exists or registration failed" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token });
  });

  app.get("/api/me", authenticate, requirePlayer, (req: any, res) => {
    res.json(req.player);
  });

  app.post("/api/profile/update", authenticate, async (req: any, res) => {
    const { display_name, email } = req.body;
    try {
      db.prepare("UPDATE users SET display_name = ?, email = ? WHERE id = ?").run(display_name, email, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/profile/password", authenticate, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) as any;
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: "Invalid current password" });
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: "Failed to update password" });
    }
  });

  const refreshShopStock = (shopId: number) => {
    const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId) as any;
    if (!shop) return;

    // Clear old stock
    db.prepare("DELETE FROM shop_stock WHERE shop_id = ?").run(shopId);

    // Get items in this category
    const items = db.prepare("SELECT * FROM items WHERE category = ?").all(shop.category) as any[];
    
    // Add random stock
    const insertStock = db.prepare("INSERT INTO shop_stock (shop_id, item_id, quantity, price) VALUES (?, ?, ?, ?)");
    for (const item of items) {
      const qty = Math.floor(Math.random() * 50) + 10;
      const price = Math.floor(item.base_price * (0.8 + Math.random() * 0.4)); // 80% to 120% of base price
      insertStock.run(shopId, item.id, qty, price);
    }

    db.prepare("UPDATE shops SET last_refresh = ? WHERE id = ?").run(Date.now(), shopId);
  };

  // Game Routes
  app.get("/api/items", (req, res) => {
    const items = db.prepare("SELECT * FROM items").all();
    res.json(items);
  });

  app.get("/api/inventory", authenticate, requirePlayer, (req: any, res) => {
    const inventory = db.prepare(`
      SELECT i.*, inv.quantity 
      FROM inventory inv 
      JOIN items i ON inv.item_id = i.id 
      WHERE inv.player_id = ?
    `).all(req.player.id);
    res.json(inventory);
  });

  app.get("/api/recipes", (req, res) => {
    const recipes = db.prepare(`
      SELECT r.*, i.name as item_name, i.category, i.rarity, i.tier, i.damage
      FROM recipes r
      JOIN items i ON r.item_id = i.id
    `).all();
    
    const recipesWithIngredients = recipes.map((r: any) => {
      const ingredients = db.prepare(`
        SELECT ri.quantity, i.name, i.id
        FROM recipe_ingredients ri
        JOIN items i ON ri.item_id = i.id
        WHERE ri.recipe_id = ?
      `).all(r.id);
      return { ...r, ingredients };
    });

    res.json(recipesWithIngredients);
  });

  // Crafting Logic
  app.post("/api/craft/start", authenticate, requirePlayer, (req: any, res) => {
    const { recipeId } = req.body;
    
    // Check if already crafting
    const active = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'crafting'").get(req.player.id);
    if (active) return res.status(400).json({ error: "Already crafting something" });

    const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(recipeId) as any;
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    // Check skill requirement
    const skillType = recipe.skill_type || 'crafting';
    const activeSkill = req.player.skills.find((s: any) => s.skill_type === skillType);
    if (!activeSkill || activeSkill.level < recipe.min_skill_level) {
      return res.status(400).json({ error: `Requires ${skillType.charAt(0).toUpperCase() + skillType.slice(1)} Level ${recipe.min_skill_level}` });
    }

    const ingredients = db.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ?").all(recipeId);

    // Check ingredients
    for (const ing of ingredients as any[]) {
      const inv = db.prepare("SELECT quantity FROM inventory WHERE player_id = ? AND item_id = ?").get(req.player.id, ing.item_id) as any;
      if (!inv || inv.quantity < ing.quantity) {
        return res.status(400).json({ error: "Not enough materials" });
      }
    }

    // Deduct ingredients
    const deduct = db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?");
    for (const ing of ingredients as any[]) {
      deduct.run(ing.quantity, req.player.id, ing.item_id);
    }

    const startTime = Date.now();
    const endTime = startTime + (recipe.duration_seconds * 1000);

    db.prepare("INSERT INTO active_tasks (player_id, task_type, target_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
      .run(req.player.id, "crafting", recipeId, startTime, endTime);

    res.json({ success: true, endTime });
  });

  app.post("/api/craft/claim", authenticate, requirePlayer, (req: any, res) => {
    const task = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'crafting'").get(req.player.id) as any;

    if (!task) return res.status(400).json({ error: "No active craft" });
    if (Date.now() < task.end_time) return res.status(400).json({ error: "Not finished yet" });

    const recipe = db.prepare(`
      SELECT r.*, i.tier, i.category, i.name as item_name
      FROM recipes r
      JOIN items i ON r.item_id = i.id
      WHERE r.id = ?
    `).get(task.target_id) as any;
    
    const skillType = recipe.skill_type || 'crafting';
    const activeSkill = req.player.skills.find((s: any) => s.skill_type === skillType) || { level: 1, xp: 0 };
    
    // Calculate success chance
    // Base + 1% per level above requirement
    const skillBonus = Math.max(0, activeSkill.level - recipe.min_skill_level);
    const finalChance = Math.min(100, recipe.success_rate + skillBonus);
    const roll = Math.random() * 100;
    
    let resultStatus = "success";
    let rewardItemId = recipe.item_id;
    let xpGained = recipe.xp_reward;

    if (roll > finalChance) {
      // Failure logic
      const failRoll = Math.random() * 100;
      if (failRoll < 50) {
        resultStatus = "downgrade";
        // Try to find a lower tier item in same category
        const tiers = ["F", "D", "C", "B", "A", "S"];
        const currentTierIdx = tiers.indexOf(recipe.tier);
        if (currentTierIdx > 0) {
          const lowerTier = tiers[currentTierIdx - 1];
          const lowerItem = db.prepare("SELECT id FROM items WHERE category = ? AND tier = ? AND type = 'product' ORDER BY RANDOM() LIMIT 1")
            .get(recipe.category, lowerTier) as any;
          if (lowerItem) {
            rewardItemId = lowerItem.id;
          } else {
            // Fallback to scrap or material
            resultStatus = "fail";
            rewardItemId = null;
          }
        } else {
          resultStatus = "fail";
          rewardItemId = null;
        }
      } else {
        resultStatus = "fail";
        rewardItemId = null;
      }
      // Still get some XP for trying
      xpGained = Math.floor(xpGained * 0.2);
    }

    if (rewardItemId) {
      const existing = db.prepare("SELECT * FROM inventory WHERE player_id = ? AND item_id = ?").get(req.player.id, rewardItemId);
      if (existing) {
        db.prepare("UPDATE inventory SET quantity = quantity + 1 WHERE player_id = ? AND item_id = ?").run(req.player.id, rewardItemId);
      } else {
        db.prepare("INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, 1)").run(req.player.id, rewardItemId);
      }
    }

    // Award Skill XP
    let newXp = activeSkill.xp + xpGained;
    let newLevel = activeSkill.level;
    const xpToNext = activeSkill.level * 100;
    if (newXp >= xpToNext) {
      newXp -= xpToNext;
      newLevel += 1;
    }
    db.prepare("UPDATE player_skills SET xp = ?, level = ? WHERE player_id = ? AND skill_type = ?")
      .run(newXp, newLevel, req.player.id, skillType);

    db.prepare("DELETE FROM active_tasks WHERE id = ?").run(task.id);
    
    const rewardItem = rewardItemId ? db.prepare("SELECT name FROM items WHERE id = ?").get(rewardItemId) as any : null;

    res.json({ 
      success: resultStatus === "success", 
      status: resultStatus,
      reward: rewardItem?.name,
      xpGained 
    });
  });

  // Gathering Logic
  app.post("/api/gather/start", authenticate, requirePlayer, (req: any, res) => {
    const { category } = req.body;
    const active = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'gathering'").get(req.player.id);
    if (active) return res.status(400).json({ error: "Already gathering" });

    const validCategories = ["wood", "mining", "animal", "plants"];
    if (!validCategories.includes(category)) return res.status(400).json({ error: "Invalid gathering type" });

    const durations: Record<string, number> = {
      wood: 60,
      mining: 300,
      animal: 120,
      plants: 30
    };
    const duration = durations[category]; 
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    // Store category in target_id as a string or map it
    const categoryMap: Record<string, number> = { "wood": 1, "mining": 2, "animal": 3, "plants": 4 };

    db.prepare("INSERT INTO active_tasks (player_id, task_type, target_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
      .run(req.player.id, "gathering", categoryMap[category], startTime, endTime);

    res.json({ success: true, endTime });
  });

  app.post("/api/gather/claim", authenticate, requirePlayer, (req: any, res) => {
    const task = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'gathering'").get(req.player.id) as any;

    if (!task) return res.status(400).json({ error: "No active gather" });
    if (Date.now() < task.end_time) return res.status(400).json({ error: "Not finished yet" });

    const reverseCategoryMap: Record<number, string> = { 1: "wood", 2: "mining", 3: "animal", 4: "plants" };
    const category = reverseCategoryMap[task.target_id];

    // Get skill level
    const skill = db.prepare("SELECT * FROM player_skills WHERE player_id = ? AND skill_type = ?").get(req.player.id, category) as any;
    const skillLevel = skill?.level || 1;

    // Random reward from category, filtered by skill if needed
    // For wood: Common (Lvl 1), Oak (Lvl 5), Rosewood (Lvl 15)
    let materials = db.prepare("SELECT id, name FROM items WHERE type = 'material' AND category = ?").all(category) as any[];
    
    if (category === 'wood') {
      materials = materials.filter(m => {
        if (m.name === 'Common Wood') return true;
        if (m.name === 'Oak Wood' && skillLevel >= 5) return true;
        if (m.name === 'Rosewood' && skillLevel >= 15) return true;
        if (m.name === 'Stick') return true;
        return false;
      });
    } else if (category === 'mining') {
      materials = materials.filter(m => {
        if (['Stone', 'Flint', 'Coal', 'Copper Ore', 'Tin Ore'].includes(m.name)) return true;
        if (m.name === 'Iron Ore' && skillLevel >= 5) return true;
        if (m.name === 'Silver Ore' && skillLevel >= 15) return true;
        if (m.name === 'Gold Ore' && skillLevel >= 30) return true;
        return false;
      });
    } else if (category === 'animal') {
      materials = materials.filter(m => {
        if (['Raw Meat', 'Raw Fish', 'Hide', 'Milk', 'Egg'].includes(m.name)) return true;
        if (['Bone', 'Feather', 'Wool'].includes(m.name) && skillLevel >= 5) return true;
        return false;
      });
    } else if (category === 'plants') {
      materials = materials.filter(m => {
        if (['Wheat', 'Corn', 'Carrot', 'Potato', 'Berry', 'Plant Matter', 'Fiber'].includes(m.name)) return true;
        if (m.name === 'Herbs' && skillLevel >= 5) return true;
        if (['Cotton', 'Sugarcane'].includes(m.name) && skillLevel >= 15) return true;
        return false;
      });
    }

    if (materials.length === 0) {
      db.prepare("DELETE FROM active_tasks WHERE id = ?").run(task.id);
      return res.status(400).json({ error: "No items found for this category" });
    }

    const reward = materials[Math.floor(Math.random() * materials.length)];
    const qty = Math.floor(Math.random() * 3) + 1;

    // Award Skill XP
    const xpGained = 10 + (skillLevel * 2);
    let newXp = (skill?.xp || 0) + xpGained;
    let newLevel = skillLevel;
    const xpToNextLevel = skillLevel * 100;

    if (newXp >= xpToNextLevel) {
      newXp -= xpToNextLevel;
      newLevel += 1;
    }

    db.prepare("UPDATE player_skills SET xp = ?, level = ? WHERE player_id = ? AND skill_type = ?")
      .run(newXp, newLevel, req.player.id, category);

    const existing = db.prepare("SELECT * FROM inventory WHERE player_id = ? AND item_id = ?").get(req.player.id, reward.id);
    if (existing) {
      db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE player_id = ? AND item_id = ?").run(qty, req.player.id, reward.id);
    } else {
      db.prepare("INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)").run(req.player.id, reward.id, qty);
    }

    db.prepare("DELETE FROM active_tasks WHERE id = ?").run(task.id);
    res.json({ success: true, reward, qty });
  });

  const ADVENTURE_TIERS: Record<string, any> = {
    F: { duration: 900, food: 2, water: 2, medicine: 0, xp: 50, risk: "Low" },
    D: { duration: 1800, food: 5, water: 5, medicine: 1, xp: 120, risk: "Moderate" },
    C: { duration: 3600, food: 10, water: 10, medicine: 2, xp: 300, risk: "High" },
    B: { duration: 7200, food: 25, water: 25, medicine: 5, xp: 800, risk: "Dangerous" },
    A: { duration: 14400, food: 60, water: 60, medicine: 10, xp: 2000, risk: "Extreme" },
    S: { duration: 36000, food: 150, water: 150, medicine: 25, xp: 6000, risk: "Lethal" },
  };

  const RANK_ORDER = ["F", "D", "C", "B", "A", "S"];

  app.get("/api/adventure/monsters", (req, res) => {
    const monsters = db.prepare("SELECT * FROM monsters").all();
    res.json(monsters);
  });

  app.get("/api/adventure/templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM adventure_templates").all();
    res.json(templates);
  });

  // Adventure Logic
  app.post("/api/adventure/start", authenticate, requirePlayer, (req: any, res) => {
    const { tier, templateId } = req.body;
    if (!ADVENTURE_TIERS[tier]) return res.status(400).json({ error: "Invalid tier" });

    const template = db.prepare("SELECT * FROM adventure_templates WHERE id = ?").get(templateId) as any;
    if (!template) return res.status(400).json({ error: "Invalid adventure template" });

    // Check if player's rank is high enough for the tier
    const playerRankIndex = RANK_ORDER.indexOf(req.player.rank_letter);
    const tierRankIndex = RANK_ORDER.indexOf(tier);
    if (tierRankIndex > playerRankIndex) {
      return res.status(400).json({ error: "Your rank is too low for this adventure" });
    }

    const active = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'adventure'").get(req.player.id);
    if (active) return res.status(400).json({ error: "Already on an adventure" });

    // Check Cooldown
    const COOLDOWN_MS = 300000; // 5 minutes
    const timeSinceLast = Date.now() - (req.player.last_adventure_claim || 0);
    if (timeSinceLast < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
      return res.status(400).json({ error: `Adventure Board is refreshing. Wait ${remaining}s` });
    }

    const requirements = ADVENTURE_TIERS[tier];
    
    // Check Food
    const foodItems = db.prepare(`
      SELECT inv.*, i.name 
      FROM inventory inv 
      JOIN items i ON inv.item_id = i.id 
      WHERE inv.player_id = ? AND i.category = 'food' AND i.name != 'Water Bottle'
    `).all(req.player.id) as any[];
    
    const totalFood = foodItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalFood < requirements.food) return res.status(400).json({ error: `Not enough food. Need ${requirements.food}` });

    // Check Water
    const waterItem = db.prepare(`
      SELECT inv.* 
      FROM inventory inv 
      JOIN items i ON inv.item_id = i.id 
      WHERE inv.player_id = ? AND i.name = 'Water Bottle'
    `).get(req.player.id) as any;
    
    if (!waterItem || waterItem.quantity < requirements.water) {
      return res.status(400).json({ error: `Not enough water. Need ${requirements.water} Water Bottles` });
    }

    // Check Medicine
    let medicineItem = null;
    if (requirements.medicine > 0) {
      medicineItem = db.prepare(`
        SELECT inv.* 
        FROM inventory inv 
        JOIN items i ON inv.item_id = i.id 
        WHERE inv.player_id = ? AND i.category = 'medicine'
      `).get(req.player.id) as any;
      
      if (!medicineItem || medicineItem.quantity < requirements.medicine) {
        return res.status(400).json({ error: `Not enough medicine. Need ${requirements.medicine} Medicine` });
      }
    }

    // Deduct Food
    let foodToDeduct = requirements.food;
    for (const item of foodItems) {
      const deduct = Math.min(item.quantity, foodToDeduct);
      db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?").run(deduct, req.player.id, item.item_id);
      foodToDeduct -= deduct;
      if (foodToDeduct <= 0) break;
    }

    // Deduct Water
    db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?").run(requirements.water, req.player.id, waterItem.item_id);

    // Deduct Medicine
    if (medicineItem) {
      db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?").run(requirements.medicine, req.player.id, medicineItem.item_id);
    }

    // Pick a random monster of the same tier
    const monsters = db.prepare("SELECT * FROM monsters WHERE tier = ?").all(tier) as any[];
    const monster = monsters.length > 0 ? monsters[Math.floor(Math.random() * monsters.length)] : null;

    const startTime = Date.now();
    const endTime = startTime + (requirements.duration * 1000);

    const extraData = JSON.stringify({
      tier,
      monsterName: monster?.name || "Unknown Threat",
      templateName: template.name,
      templateType: template.type
    });

    db.prepare("INSERT INTO active_tasks (player_id, task_type, target_id, extra_data, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)")
      .run(req.player.id, "adventure", templateId, extraData, startTime, endTime);

    res.json({ success: true, endTime });
  });

  app.post("/api/adventure/claim", authenticate, requirePlayer, (req: any, res) => {
    const task = db.prepare("SELECT * FROM active_tasks WHERE player_id = ? AND task_type = 'adventure'").get(req.player.id) as any;
    if (!task) return res.status(400).json({ error: "No active adventure" });
    if (Date.now() < task.end_time) return res.status(400).json({ error: "Not finished yet" });

    const extraData = JSON.parse(task.extra_data);
    const tier = extraData.tier;
    const rewards = ADVENTURE_TIERS[tier];

    // Award XP
    let newXp = req.player.adventure_xp + rewards.xp;
    let newLevel = req.player.rank_level;
    let newRank = req.player.rank_letter;

    // Rank Level Up (100 XP per level for simplicity, or scale it)
    const xpPerLevel = 100; 
    while (newXp >= xpPerLevel) {
      newXp -= xpPerLevel;
      newLevel += 1;
      if (newLevel > 100) {
        const currentRankIndex = RANK_ORDER.indexOf(newRank);
        if (currentRankIndex < RANK_ORDER.length - 1) {
          newRank = RANK_ORDER[currentRankIndex + 1];
          newLevel = 1;
        } else {
          newLevel = 100; // Max rank reached
          newXp = 0;
          break;
        }
      }
    }

    db.prepare(`
      UPDATE players 
      SET adventure_xp = ?, rank_level = ?, rank_letter = ?, completed_adventures = completed_adventures + 1, last_adventure_claim = ?
      WHERE id = ?
    `).run(newXp, newLevel, newRank, Date.now(), req.player.id);

    db.prepare("DELETE FROM active_tasks WHERE id = ?").run(task.id);

    res.json({ success: true, xpGained: rewards.xp, newRank, newLevel });
  });

  // Guild Logic
  app.post("/api/guild/create", authenticate, requirePlayer, (req: any, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Guild name required" });

    const existingMember = db.prepare("SELECT * FROM guild_members WHERE player_id = ?").get(req.player.id);
    if (existingMember) return res.status(400).json({ error: "You are already in a guild" });

    try {
      const result = db.prepare("INSERT INTO guilds (name, leader_id) VALUES (?, ?)").run(name, req.player.id);
      db.prepare("INSERT INTO guild_members (guild_id, player_id) VALUES (?, ?)").run(result.lastInsertRowid, req.player.id);
      res.json({ success: true, guildId: result.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Guild name already taken" });
    }
  });

  app.get("/api/guild/me", authenticate, requirePlayer, (req: any, res) => {
    const member = db.prepare("SELECT * FROM guild_members WHERE player_id = ?").get(req.player.id) as any;
    if (!member) return res.json(null);

    const guild = db.prepare("SELECT * FROM guilds WHERE id = ?").get(member.guild_id) as any;
    const members = db.prepare(`
      SELECT p.*, u.display_name, u.username 
      FROM guild_members gm 
      JOIN players p ON gm.player_id = p.id 
      JOIN users u ON p.user_id = u.id 
      WHERE gm.guild_id = ?
    `).all(member.guild_id);

    res.json({ ...guild, members });
  });

  app.post("/api/guild/promote", authenticate, requirePlayer, (req: any, res) => {
    const member = db.prepare("SELECT * FROM guild_members WHERE player_id = ?").get(req.player.id) as any;
    if (!member) return res.status(400).json({ error: "Not in a guild" });

    const guild = db.prepare("SELECT * FROM guilds WHERE id = ?").get(member.guild_id) as any;
    if (guild.leader_id !== req.player.id) return res.status(403).json({ error: "Only the leader can promote the guild" });

    if (guild.guild_class <= 1) return res.status(400).json({ error: "Guild is already at max class" });

    const nextClass = guild.guild_class - 1;
    
    // Rank Requirements:
    // 12,11 -> F
    // 10,9 -> D
    // 8,7 -> C
    // 6,5 -> B
    // 4,3 -> A
    // 2,1 -> S
    const classToRank: Record<number, string> = {
      12: "F", 11: "F",
      10: "D", 9: "D",
      8: "C", 7: "C",
      6: "B", 5: "B",
      4: "A", 3: "A",
      2: "S", 1: "S"
    };

    const requiredRank = classToRank[nextClass];
    const requiredRankIndex = RANK_ORDER.indexOf(requiredRank);

    const members = db.prepare("SELECT p.* FROM guild_members gm JOIN players p ON gm.player_id = p.id WHERE gm.guild_id = ?").all(guild.id) as any[];
    
    const allMeetRank = members.every(m => RANK_ORDER.indexOf(m.rank_letter) >= requiredRankIndex);
    if (!allMeetRank) return res.status(400).json({ error: `All members must be at least ${requiredRank} rank for Class ${nextClass}` });

    // Adventure requirement (e.g., 10 * (13 - nextClass) adventures)
    const requiredAdventures = (13 - nextClass) * 5; 
    const totalAdventures = members.reduce((sum, m) => sum + m.completed_adventures, 0);
    if (totalAdventures < requiredAdventures) {
      return res.status(400).json({ error: `Guild needs at least ${requiredAdventures} total completed adventures (Currently: ${totalAdventures})` });
    }

    db.prepare("UPDATE guilds SET guild_class = ? WHERE id = ?").run(nextClass, guild.id);
    res.json({ success: true, newClass: nextClass });
  });

  app.get("/api/tasks", authenticate, requirePlayer, (req: any, res) => {
    const tasks = db.prepare("SELECT * FROM active_tasks WHERE player_id = ?").all(req.player.id);
    res.json(tasks);
  });

  // Shop Routes
  app.get(["/api/shops", "/api/npc-shops"], (req, res) => {
    const shops = db.prepare("SELECT * FROM shops").all();
    res.json(shops);
  });

  app.get("/api/shops/:id/stock", (req, res) => {
    const shop = db.prepare("SELECT * FROM shops WHERE id = ?").get(req.params.id) as any;
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - shop.last_refresh > ONE_HOUR) {
      refreshShopStock(Number(req.params.id));
    }

    const stock = db.prepare(`
      SELECT s.*, i.name, i.category, i.type
      FROM shop_stock s
      JOIN items i ON s.item_id = i.id
      WHERE s.shop_id = ?
    `).all(req.params.id);
    res.json(stock);
  });

  app.post("/api/shops/buy", authenticate, requirePlayer, (req: any, res) => {
    const { shopId, itemId, quantity } = req.body;
    const stock = db.prepare("SELECT * FROM shop_stock WHERE shop_id = ? AND item_id = ?").get(shopId, itemId) as any;

    if (!stock || stock.quantity < quantity) return res.status(400).json({ error: "Not enough stock" });
    const totalCost = stock.price * quantity;
    if (req.player.gold < totalCost) return res.status(400).json({ error: "Not enough gold" });

    // Update DB
    db.prepare("UPDATE players SET gold = gold - ? WHERE id = ?").run(totalCost, req.player.id);
    db.prepare("UPDATE shop_stock SET quantity = quantity - ? WHERE shop_id = ? AND item_id = ?").run(quantity, shopId, itemId);
    
    const existing = db.prepare("SELECT * FROM inventory WHERE player_id = ? AND item_id = ?").get(req.player.id, itemId);
    if (existing) {
      db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE player_id = ? AND item_id = ?").run(quantity, req.player.id, itemId);
    } else {
      db.prepare("INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)").run(req.player.id, itemId, quantity);
    }

    res.json({ success: true });
  });

  app.post("/api/shops/sell", authenticate, requirePlayer, (req: any, res) => {
    const { itemId, quantity } = req.body;
    const inv = db.prepare("SELECT * FROM inventory WHERE player_id = ? AND item_id = ?").get(req.player.id, itemId) as any;
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as any;

    if (!inv || inv.quantity < quantity) return res.status(400).json({ error: "Not enough items" });
    
    const sellPrice = Math.floor(item.base_price * 0.8) * quantity;

    db.prepare("UPDATE players SET gold = gold + ? WHERE id = ?").run(sellPrice, req.player.id);
    db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?").run(quantity, req.player.id, itemId);

    res.json({ success: true, goldEarned: sellPrice });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
