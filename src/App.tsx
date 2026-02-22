import React, { useState, useEffect } from "react";
import { 
  Backpack, 
  Hammer, 
  Pickaxe, 
  Store, 
  User, 
  Coins, 
  Clock, 
  CheckCircle2, 
  LogOut,
  ChevronRight,
  Mail,
  Lock,
  Shield,
  Zap,
  Trophy,
  Map,
  Users,
  Sword,
  Compass,
  Star,
  Utensils,
  Leaf
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "./api";

// --- Types ---
interface Item {
  id: number;
  name: string;
  type: string;
  category: string;
  rarity: string;
  tier: string;
  damage: number;
  stat_value: number;
  base_price: number;
  quantity?: number;
}

interface Recipe {
  id: number;
  item_id: number;
  item_name: string;
  category: string;
  rarity: string;
  tier: string;
  damage: number;
  skill_type: string;
  duration_seconds: number;
  min_skill_level: number;
  success_rate: number;
  xp_reward: number;
  ingredients: { id: number; name: string; quantity: number }[];
}

interface Task {
  id: number;
  task_type: string;
  target_id: number;
  start_time: number;
  end_time: number;
}

interface Shop {
  id: number;
  name: string;
  category: string;
}

// --- Components ---

const Timer = ({ endTime, onComplete }: { endTime: number; onComplete: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        onComplete();
        return false;
      }
      return true;
    };

    if (!tick()) return;

    const timer = setInterval(() => {
      if (!tick()) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]); // Only depend on endTime to avoid double-triggering onComplete

  return (
    <div className="flex items-center gap-2 text-amber-500 font-mono">
      <Clock size={16} className="animate-pulse" />
      <span>{timeLeft}s</span>
    </div>
  );
};

export default function App() {
  const [player, setPlayer] = useState<any>(null);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState("inventory");
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now());

  // Profile fields
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Filters
  const [invFilter, setInvFilter] = useState("all");
  const [craftFilter, setCraftFilter] = useState("all");

  // Shop state
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopStock, setShopStock] = useState<any[]>([]);

  // Guild state
  const [guild, setGuild] = useState<any>(null);
  const [guildNameInput, setGuildNameInput] = useState("");

  // Adventure state
  const [adventureTemplates, setAdventureTemplates] = useState<any[]>([]);
  const [monsters, setMonsters] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<string>("F");

  const loadData = async () => {
    try {
      const [p, inv, rec, t, s, g, at, m] = await Promise.all([
        api.getMe(),
        api.getInventory(),
        api.getRecipes(),
        api.getTasks(),
        api.getShops(),
        api.getGuild(),
        api.getAdventureTemplates(),
        api.getMonsters()
      ]) as [any, any, any, any, any, any, any, any];
      
      if (p && !p.error) {
        setPlayer(p);
        setEditDisplayName(p.display_name || "");
        setEditEmail(p.email || "");
      } else if (p && p.error) {
        logout();
        return;
      }

      if (Array.isArray(inv)) setInventory(inv);
      if (Array.isArray(rec)) setRecipes(rec);
      if (Array.isArray(t)) setTasks(t);
      if (Array.isArray(s)) setShops(s);
      if (g && !g.error) setGuild(g);
      if (Array.isArray(at)) setAdventureTemplates(at);
      if (Array.isArray(m)) setMonsters(m);
    } catch (err: any) {
      if (err.status === 401) {
        logout();
      } else {
        console.error("LoadData Error:", err);
        if (err.message?.includes("expired") || err.message?.includes("session") || err.message?.includes("Unauthorized") || err.message?.includes("token") || err.message?.includes("not found")) {
          logout();
        }
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadData().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = (authMode === "login" 
        ? await api.login({ username, password })
        : await api.register({ username, password })) as any;
      
      if (res.error) throw new Error(res.error);
      
      if (authMode === "login") {
        localStorage.setItem("token", res.token);
        await loadData();
      } else {
        setAuthMode("login");
        setError("Registration successful! Please login.");
      }
    } catch (err: any) {
      setError(err.message);
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setPlayer(null);
    setInventory([]);
    setRecipes([]);
    setTasks([]);
    setShops([]);
    setError("");
  };

  const startCraft = async (recipeId: number) => {
    try {
      const res = await api.startCraft(recipeId) as any;
      if (res.error) return alert(res.error);
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const claimCraft = async () => {
    try {
      const res = await api.claimCraft() as any;
      if (res.error) return alert(res.error);
      
      if (res.status === "success") {
        alert(`Success! You crafted ${res.reward} and gained ${res.xpGained} Crafting XP.`);
      } else if (res.status === "downgrade") {
        alert(`Crafting failed, but you managed to salvage a ${res.reward}. Gained ${res.xpGained} Crafting XP.`);
      } else {
        alert(`Crafting failed! Materials were lost. Gained ${res.xpGained} Crafting XP for the attempt.`);
      }
      
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const startGather = async (category: string) => {
    try {
      const res = await api.startGather(category) as any;
      if (res.error) return alert(res.error);
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const claimGather = async () => {
    try {
      const res = await api.claimGather() as any;
      if (res.success) {
        alert(`Gathered ${res.qty}x ${res.reward.name}!`);
      }
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const openShop = async (shop: Shop) => {
    setSelectedShop(shop);
    const stock = await api.getShopStock(shop.id);
    setShopStock(stock);
    setActiveTab("shop-detail");
  };

  const buyItem = async (itemId: number, qty: number) => {
    try {
      const res = await api.buyItem({ shopId: selectedShop?.id, itemId, quantity: qty }) as any;
      if (res.error) return alert(res.error);
      if (selectedShop) openShop(selectedShop);
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const sellItem = async (itemId: number, qty: number) => {
    try {
      const res = await api.sellItem({ itemId, quantity: qty }) as any;
      if (res.error) return alert(res.error);
      await loadData();
    } catch (err: any) {
      if (err.message?.includes("expired") || err.message?.includes("Unauthorized")) {
        logout();
      }
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({ display_name: editDisplayName, email: editEmail });
      setSuccess("Profile updated successfully!");
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updatePassword({ currentPassword, newPassword });
      setSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startAdventure = async (tier: string, templateId: number) => {
    try {
      const res = await api.startAdventure(tier, templateId) as any;
      if (res.error) return alert(res.error);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const claimAdventure = async () => {
    try {
      const res = await api.claimAdventure() as any;
      if (res.error) return alert(res.error);
      
      let monsterName = "Monster";
      try {
        if (activeAdventure?.extra_data) {
          monsterName = JSON.parse(activeAdventure.extra_data).monsterName || "Monster";
        }
      } catch (e) {
        console.error("Failed to parse adventure extra_data:", e);
      }
      
      alert(`Victory! You defeated ${monsterName} and gained ${res.xpGained} Rank XP.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const createGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createGuild(guildNameInput) as any;
      if (res.error) return alert(res.error);
      setGuildNameInput("");
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const promoteGuild = async () => {
    try {
      const res = await api.promoteGuild() as any;
      if (res.error) return alert(res.error);
      alert(`Guild promoted to Class ${res.newClass}!`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-400">Loading Game State...</div>;

  if (!player) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
              <Hammer className="text-amber-500" size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-stone-100 text-center mb-2">Crafting Commerce</h1>
          <p className="text-stone-500 text-center mb-8 text-sm">A world of trade and creation awaits.</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-500/10">
              {authMode === "login" ? "Enter World" : "Create Character"}
            </button>
          </form>
          
          <p className="mt-6 text-center text-sm text-stone-500">
            {authMode === "login" ? "New here?" : "Already have a character?"}{" "}
            <button 
              onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              className="text-amber-500 hover:text-amber-400 font-semibold"
            >
              {authMode === "login" ? "Register" : "Login"}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  const activeCraft = Array.isArray(tasks) ? tasks.find(t => t.task_type === "crafting") : undefined;
  const activeGather = Array.isArray(tasks) ? tasks.find(t => t.task_type === "gathering") : undefined;
  const activeAdventure = Array.isArray(tasks) ? tasks.find(t => t.task_type === "adventure") : undefined;

  // Helper to check if a task is finished with a small buffer for sync
  const isTaskFinished = (endTime: number) => now >= endTime - 100;

  const getRarityColor = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case 'rare': return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
      case 'epic': return 'text-purple-400 border-purple-500/30 bg-purple-500/5';
      case 'legendary': return 'text-orange-400 border-orange-500/30 bg-orange-500/5';
      default: return 'text-stone-400 border-stone-800 bg-stone-900/50';
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case 'rare': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'epic': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'legendary': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-stone-800/50 text-stone-500 border-stone-700';
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-950/80 backdrop-blur-md border-b border-stone-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <User className="text-amber-500" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100 leading-tight">Level {player.level}</h2>
              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Adventurer</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-stone-900/50 border border-stone-800 px-3 py-1.5 rounded-full">
              <Coins size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-500">{player.gold}</span>
            </div>
            <button onClick={logout} className="p-2 text-stone-500 hover:text-red-400 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "inventory" && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold">Inventory</h1>
                <div className="flex flex-wrap gap-2">
                  {["all", "wood", "mining", "animal", "plants", "basic", "ingot", "gear", "food", "trade"].map(f => (
                    <button
                      key={f}
                      onClick={() => setInvFilter(f)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                        invFilter === f 
                          ? 'bg-amber-500 border-amber-500 text-stone-950' 
                          : 'bg-stone-900 border-stone-800 text-stone-500 hover:border-stone-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {inventory.length === 0 ? (
                <div className="bg-stone-900/30 border border-dashed border-stone-800 rounded-2xl p-12 text-center">
                  <Backpack className="mx-auto text-stone-700 mb-4" size={48} />
                  <p className="text-stone-500">Your pack is empty. Go gather some materials!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {inventory
                    .filter(item => invFilter === "all" || item.category === invFilter)
                    .map(item => (
                    <div key={item.id} className={`bg-stone-900 border rounded-2xl p-4 flex items-center justify-between group transition-colors ${item.rarity !== 'common' ? 'border-stone-700' : 'border-stone-800'} hover:border-stone-600`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          item.rarity === 'legendary' ? 'bg-orange-500/10 text-orange-500' :
                          item.rarity === 'epic' ? 'bg-purple-500/10 text-purple-500' :
                          item.rarity === 'rare' ? 'bg-blue-500/10 text-blue-500' :
                          item.type === 'material' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-500/10 text-stone-500'
                        }`}>
                          {item.type === 'material' ? <Pickaxe size={24} /> : <Hammer size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold ${item.rarity === 'legendary' ? 'text-orange-400' : item.rarity === 'epic' ? 'text-purple-400' : item.rarity === 'rare' ? 'text-blue-400' : 'text-stone-100'}`}>
                              {item.name}
                            </h3>
                            {item.rarity !== 'common' && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold border ${getRarityBadge(item.rarity)}`}>
                                {item.rarity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 uppercase tracking-tighter">{item.category}</p>
                          <div className="flex gap-2 mt-1">
                            {item.damage > 0 && (
                              <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                <Sword size={10} /> {item.damage} DMG
                              </span>
                            )}
                            {item.stat_value > 0 && (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <Zap size={10} /> {item.stat_value} {item.category === 'food' ? 'SAT' : 'VAL'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-stone-100">x{item.quantity}</span>
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => sellItem(item.id, 1)}
                            className="text-[10px] bg-stone-800 hover:bg-stone-700 px-2 py-1 rounded-md transition-colors"
                          >
                            Sell 1
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "crafting" && (
            <motion.div 
              key="crafting"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold">Workshop</h1>
                <div className="flex flex-wrap gap-2">
                  {["all", "basic", "ingot", "gear", "food", "trade"].map(f => (
                    <button
                      key={f}
                      onClick={() => setCraftFilter(f)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                        craftFilter === f 
                          ? 'bg-amber-500 border-amber-500 text-stone-950' 
                          : 'bg-stone-900 border-stone-800 text-stone-500 hover:border-stone-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {recipes
                  .filter(r => craftFilter === "all" || r.category === craftFilter)
                  .map(recipe => {
                  const canCraft = recipe.ingredients.every(ing => {
                    const inv = inventory.find(i => i.id === ing.id);
                    return inv && inv.quantity! >= ing.quantity;
                  });

                  const isThisRecipeActive = activeCraft && activeCraft.target_id === recipe.id;

                  return (
                    <div key={recipe.id} className={`bg-stone-900 border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${recipe.rarity !== 'common' ? 'border-stone-700' : 'border-stone-800'} hover:border-stone-600`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            recipe.rarity === 'legendary' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            recipe.rarity === 'epic' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            recipe.rarity === 'rare' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            recipe.category === 'ingot' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            recipe.category === 'gear' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            recipe.category === 'food' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            recipe.category === 'trade' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {recipe.category === 'gear' ? <Shield size={20} /> : <Hammer size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-bold text-lg ${recipe.rarity === 'legendary' ? 'text-orange-400' : recipe.rarity === 'epic' ? 'text-purple-400' : recipe.rarity === 'rare' ? 'text-blue-400' : 'text-stone-100'}`}>
                                {recipe.item_name}
                              </h3>
                              {recipe.rarity !== 'common' && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold border ${getRarityBadge(recipe.rarity)}`}>
                                  {recipe.rarity}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-mono border border-stone-700">
                                Tier {recipe.tier}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">{recipe.duration_seconds}s Craft Time</p>
                              {recipe.damage > 0 && (
                                <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold uppercase">
                                  <Sword size={10} />
                                  <span>{recipe.damage} DMG</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest ml-1">Ingredients</p>
                            <div className="flex flex-wrap gap-2">
                              {recipe.ingredients.map(ing => {
                                const inv = inventory.find(i => i.id === ing.id);
                                const hasEnough = inv && inv.quantity! >= ing.quantity;
                                return (
                                  <div key={ing.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${hasEnough ? 'bg-stone-800/50 border-stone-700 text-stone-300' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                                    {ing.name}: {inv?.quantity || 0}/{ing.quantity}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest ml-1">Requirements & Odds</p>
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const skillType = recipe.skill_type || 'crafting';
                                const activeSkill = player.skills?.find((s: any) => s.skill_type === skillType);
                                const skillLevel = activeSkill?.level || 1;
                                const skillBonus = Math.max(0, skillLevel - recipe.min_skill_level);
                                const finalChance = Math.min(100, recipe.success_rate + skillBonus);
                                const isSkillMet = skillLevel >= recipe.min_skill_level;
                                
                                return (
                                  <>
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${isSkillMet ? 'bg-stone-800/50 border-stone-700 text-stone-300' : 'bg-orange-500/5 border-orange-500/20 text-orange-400'}`}>
                                      {skillType.charAt(0).toUpperCase() + skillType.slice(1)}: Lvl {recipe.min_skill_level}
                                    </div>
                                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-stone-800/50 border-stone-700 text-amber-500">
                                      Success: {finalChance}%
                                    </div>
                                    {finalChance < 100 && recipe.tier !== 'F' && (
                                      <div className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-stone-800/50 border-stone-700 text-blue-400">
                                        Downgrade: {Math.floor((100 - finalChance) * 0.5)}%
                                      </div>
                                    )}
                                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-stone-800/50 border-stone-700 text-emerald-500">
                                      XP: +{recipe.xp_reward}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {isThisRecipeActive ? (
                        <div className="w-full md:w-auto">
                          {isTaskFinished(activeCraft.end_time) ? (
                            <button 
                              onClick={claimCraft}
                              className="w-full md:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl transition-all animate-bounce shadow-lg shadow-emerald-500/20"
                            >
                              Claim Reward
                            </button>
                          ) : (
                            <div className="bg-stone-800 px-8 py-3 rounded-xl border border-stone-700 flex justify-center">
                              <Timer endTime={activeCraft.end_time} onComplete={loadData} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <button 
                          disabled={!canCraft || !!activeCraft}
                          onClick={() => startCraft(recipe.id)}
                          className={`px-8 py-3 rounded-xl font-bold transition-all ${
                            !canCraft 
                              ? 'bg-stone-800 text-stone-600 cursor-not-allowed opacity-50' 
                              : !!activeCraft 
                                ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'
                                : 'bg-stone-100 hover:bg-white text-stone-950 shadow-lg'
                          }`}
                        >
                          {!canCraft ? 'Missing Materials' : 'Start Craft'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === "gathering" && (
            <motion.div 
              key="gathering"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <h1 className="text-2xl font-bold">The Wilds</h1>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'wood', name: 'Woodcutting', icon: <Pickaxe size={24} />, color: 'amber', desc: 'Gather logs and sticks (60s).' },
                  { id: 'mining', name: 'Mining', icon: <Pickaxe size={24} />, color: 'blue', desc: 'Extract ores and minerals (300s).' },
                  { id: 'animal', name: 'Hunting', icon: <User size={24} />, color: 'red', desc: 'Hunt for hides, meat, and more (120s).' },
                  { id: 'plants', name: 'Foraging', icon: <Backpack size={24} />, color: 'emerald', desc: 'Pick berries, herbs, and crops (30s).' },
                ].map(zone => {
                  const zoneId = zone.id === 'wood' ? 1 : zone.id === 'mining' ? 2 : zone.id === 'animal' ? 3 : 4;
                  const isThisActive = activeGather && Number(activeGather.target_id) === zoneId;
                  
                  return (
                    <div key={zone.id} className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                      <div className={`w-16 h-16 bg-${zone.color}-500/10 rounded-full flex items-center justify-center mb-4 border border-${zone.color}-500/20 text-${zone.color}-500`}>
                        {zone.icon}
                      </div>
                      <h3 className="font-bold text-lg mb-1">{zone.name}</h3>
                      <p className="text-xs text-stone-500 mb-6">{zone.desc}</p>
                      
                      {isThisActive ? (
                        <div className="w-full">
                          {isTaskFinished(activeGather.end_time) ? (
                            <button 
                              onClick={claimGather}
                              className="w-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold py-3 rounded-xl transition-all animate-bounce shadow-lg shadow-emerald-500/20"
                            >
                              Claim Resources
                            </button>
                          ) : (
                            <div className="bg-stone-800 py-3 rounded-xl border border-stone-700 w-full flex justify-center">
                              <Timer endTime={activeGather.end_time} onComplete={loadData} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <button 
                          disabled={!!activeGather}
                          onClick={() => startGather(zone.id)}
                          className={`w-full bg-stone-100 hover:bg-white text-stone-950 font-bold py-3 rounded-xl transition-all ${activeGather ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Start Gathering
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === "adventure" && (
            <motion.div 
              key="adventure"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Adventure Board</h1>
                  <p className="text-xs text-stone-500 uppercase tracking-widest">Rank {player.rank_letter} • Level {player.rank_level}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-stone-500 uppercase font-bold">Rank XP</p>
                    <p className="text-sm font-mono text-amber-500">{player.adventure_xp} / 100</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 text-amber-500 font-bold text-xl">
                    {player.rank_letter}
                  </div>
                </div>
              </div>

              {activeAdventure ? (
                <div className="bg-stone-900 border border-amber-500/30 rounded-3xl p-8 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: (activeAdventure.end_time - activeAdventure.start_time) / 1000, ease: "linear" }}
                      className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                    />
                  </div>
                  
                  <div className="inline-flex p-4 bg-amber-500/10 rounded-2xl text-amber-500 mb-2">
                    <Compass size={48} className="animate-pulse" />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl font-bold text-stone-100 mb-1">
                      {(() => {
                        try {
                          return activeAdventure.extra_data ? JSON.parse(activeAdventure.extra_data).templateName : "Adventure";
                        } catch (e) {
                          return "Adventure";
                        }
                      })()}
                    </h2>
                    <p className="text-stone-400">
                      Facing: <span className="text-amber-500 font-bold">
                        {(() => {
                          try {
                            return activeAdventure.extra_data ? JSON.parse(activeAdventure.extra_data).monsterName : "Monster";
                          } catch (e) {
                            return "Monster";
                          }
                        })()}
                      </span>
                    </p>
                  </div>

                  <div className="flex justify-center py-4">
                    {isTaskFinished(activeAdventure.end_time) ? (
                      <button 
                        onClick={claimAdventure}
                        className="px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black rounded-2xl transition-all animate-bounce shadow-xl shadow-emerald-500/20 uppercase tracking-widest"
                      >
                        Claim Victory
                      </button>
                    ) : (
                      <div className="bg-stone-800/50 backdrop-blur px-8 py-4 rounded-2xl border border-stone-700">
                        <p className="text-[10px] text-stone-500 uppercase font-bold mb-1">Time Remaining</p>
                        <Timer endTime={activeAdventure.end_time} onComplete={loadData} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Tier Selection */}
                  <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 ml-1">Select Tier</h2>
                    <div className="grid grid-cols-3 gap-2">
                      {["F", "D", "C", "B", "A", "S"].map(tier => {
                        const rankOrder = ["F", "D", "C", "B", "A", "S"];
                        const isLocked = rankOrder.indexOf(tier) > rankOrder.indexOf(player.rank_letter);
                        
                        return (
                          <button
                            key={tier}
                            disabled={isLocked}
                            onClick={() => setSelectedTier(tier)}
                            className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                              isLocked ? 'bg-stone-950 border-stone-900 text-stone-800 cursor-not-allowed' :
                              selectedTier === tier ? 'bg-amber-500 border-amber-400 text-stone-950 shadow-lg shadow-amber-500/20' :
                              'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                            }`}
                          >
                            <span className="text-xl font-black">{tier}</span>
                            {isLocked && <Lock size={10} />}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Risk Level</span>
                        <span className={`text-xs font-bold ${
                          selectedTier === 'F' ? 'text-emerald-400' :
                          selectedTier === 'D' ? 'text-blue-400' :
                          selectedTier === 'C' ? 'text-amber-400' :
                          selectedTier === 'B' ? 'text-orange-400' :
                          selectedTier === 'A' ? 'text-red-400' : 'text-purple-400'
                        }`}>
                          {selectedTier === 'F' ? 'Low' : selectedTier === 'D' ? 'Moderate' : selectedTier === 'C' ? 'High' : selectedTier === 'B' ? 'Dangerous' : selectedTier === 'A' ? 'Extreme' : 'Lethal'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Duration</span>
                        <span className="text-xs font-bold text-stone-300">
                          {selectedTier === 'F' ? '15m' : selectedTier === 'D' ? '30m' : selectedTier === 'C' ? '1h' : selectedTier === 'B' ? '2h' : selectedTier === 'A' ? '4h' : '10h'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Food Required</span>
                        <span className="text-xs font-bold text-stone-300">
                          {selectedTier === 'F' ? '2' : selectedTier === 'D' ? '5' : selectedTier === 'C' ? '10' : selectedTier === 'B' ? '25' : selectedTier === 'A' ? '60' : '150'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Water Required</span>
                        <span className="text-xs font-bold text-stone-300">
                          {selectedTier === 'F' ? '2' : selectedTier === 'D' ? '5' : selectedTier === 'C' ? '10' : selectedTier === 'B' ? '25' : selectedTier === 'A' ? '60' : '150'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Medicine Required</span>
                        <span className="text-xs font-bold text-stone-300">
                          {selectedTier === 'F' ? '0' : selectedTier === 'D' ? '1' : selectedTier === 'C' ? '2' : selectedTier === 'B' ? '5' : selectedTier === 'A' ? '10' : '25'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-stone-800">
                        <span className="text-xs text-stone-500">Expected XP</span>
                        <span className="text-xs font-bold text-amber-500">
                          {selectedTier === 'F' ? '50' : selectedTier === 'D' ? '120' : selectedTier === 'C' ? '300' : selectedTier === 'B' ? '800' : selectedTier === 'A' ? '2000' : '6000'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Template Selection */}
                  <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 ml-1">Select Objective</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {adventureTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            selectedTemplate?.id === template.id ? 'bg-stone-900 border-amber-500/50 shadow-lg' : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              template.type === 'hunt' ? 'bg-red-500/10 text-red-500' :
                              template.type === 'resource' ? 'bg-emerald-500/10 text-emerald-500' :
                              template.type === 'escort' ? 'bg-blue-500/10 text-blue-500' :
                              template.type === 'dungeon' ? 'bg-purple-500/10 text-purple-500' :
                              template.type === 'exploration' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-stone-500/10 text-stone-400'
                            }`}>
                              {template.type === 'hunt' ? <Sword size={18} /> : 
                               template.type === 'resource' ? <Pickaxe size={18} /> :
                               template.type === 'escort' ? <Shield size={18} /> :
                               template.type === 'dungeon' ? <Trophy size={18} /> :
                               template.type === 'exploration' ? <Compass size={18} /> :
                               <Star size={18} />}
                            </div>
                            <h3 className="font-bold text-stone-100">{template.name}</h3>
                          </div>
                          <p className="text-[10px] text-stone-500 leading-relaxed">{template.description}</p>
                        </button>
                      ))}
                    </div>
                    
                    <button
                      disabled={!selectedTemplate || !selectedTier}
                      onClick={() => startAdventure(selectedTier, selectedTemplate.id)}
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all ${
                        !selectedTemplate ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-xl shadow-amber-500/20'
                      }`}
                    >
                      Embark on Adventure
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "guild" && (
            <motion.div 
              key="guild"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              {!guild ? (
                <div className="max-w-md mx-auto space-y-8 py-12">
                  <div className="text-center space-y-4">
                    <div className="inline-flex p-6 bg-stone-900 rounded-3xl border border-stone-800 text-stone-500 mb-4">
                      <Users size={64} />
                    </div>
                    <h1 className="text-3xl font-bold">Found a Guild</h1>
                    <p className="text-stone-500">Unite with other adventurers to tackle S-tier threats and climb the global rankings.</p>
                  </div>
                  
                  <form onSubmit={createGuild} className="space-y-4">
                    <input 
                      type="text" 
                      value={guildNameInput}
                      onChange={e => setGuildNameInput(e.target.value)}
                      placeholder="Enter Guild Name"
                      className="w-full bg-stone-900 border border-stone-800 rounded-2xl px-6 py-4 text-stone-100 focus:outline-none focus:border-amber-500 transition-all"
                    />
                    <button className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/20 uppercase tracking-widest">
                      Establish Guild
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-stone-900 border border-stone-800 rounded-3xl p-8">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 text-amber-500">
                        <Users size={40} />
                      </div>
                      <div>
                        <h1 className="text-3xl font-black text-stone-100">{guild.name}</h1>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="px-3 py-1 bg-stone-800 rounded-full text-[10px] font-bold text-stone-400 uppercase tracking-widest border border-stone-700">
                            Class {guild.guild_class}
                          </span>
                          <span className="text-xs text-stone-500">{guild.members.length} Members</span>
                        </div>
                      </div>
                    </div>
                    
                    {guild.leader_id === player.id && (
                      <button 
                        onClick={promoteGuild}
                        className="px-8 py-3 bg-stone-100 hover:bg-white text-stone-950 font-bold rounded-xl transition-all shadow-lg"
                      >
                        Promote Guild
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 ml-1">Guild Roster</h2>
                      <div className="space-y-3">
                        {guild.members.map((member: any) => (
                          <div key={member.id} className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center text-stone-500 font-bold">
                                {member.rank_letter}
                              </div>
                              <div>
                                <h3 className="font-bold text-stone-100">{member.display_name || member.username}</h3>
                                <p className="text-[10px] text-stone-500 uppercase font-bold tracking-tighter">Level {member.level} • Rank {member.rank_letter}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-stone-500 uppercase font-bold">Adventures</p>
                              <p className="text-sm font-mono text-stone-300">{member.completed_adventures}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 ml-1">Class Requirements</h2>
                      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-stone-500 uppercase font-bold">Next Class</p>
                          <p className="text-lg font-bold text-stone-100">Class {guild.guild_class - 1}</p>
                        </div>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              guild.members.every((m: any) => {
                                const rankOrder = ["F", "D", "C", "B", "A", "S"];
                                const classToRank: any = { 12: "F", 11: "F", 10: "D", 9: "D", 8: "C", 7: "C", 6: "B", 5: "B", 4: "A", 3: "A", 2: "S", 1: "S" };
                                const reqRank = classToRank[guild.guild_class - 1];
                                return rankOrder.indexOf(m.rank_letter) >= rankOrder.indexOf(reqRank);
                              }) ? 'bg-emerald-500/20 text-emerald-500' : 'bg-stone-800 text-stone-600'
                            }`}>
                              <Star size={12} />
                            </div>
                            <span className="text-xs text-stone-400">All members at required Rank</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              guild.members.reduce((sum: number, m: any) => sum + m.completed_adventures, 0) >= (13 - (guild.guild_class - 1)) * 5 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-stone-800 text-stone-600'
                            }`}>
                              <Compass size={12} />
                            </div>
                            <span className="text-xs text-stone-400">Total Guild Adventures</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "character" && (
            <motion.div 
              key="character"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Character Profile</h1>
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Form */}
                <div className="space-y-6">
                  <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <User size={20} className="text-amber-500" />
                      Personal Info
                    </h2>
                    <form onSubmit={updateProfile} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Display Name</label>
                        <input 
                          type="text" 
                          value={editDisplayName}
                          onChange={e => setEditDisplayName(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                          placeholder="Your display name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                        <input 
                          type="email" 
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                          placeholder="your@email.com"
                        />
                      </div>
                      <button className="w-full bg-stone-100 hover:bg-white text-stone-950 font-bold py-2.5 rounded-xl transition-all">
                        Update Profile
                      </button>
                    </form>
                  </div>

                  <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Lock size={20} className="text-amber-500" />
                      Security
                    </h2>
                    <form onSubmit={updatePassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Current Password</label>
                        <input 
                          type="password" 
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">New Password</label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                      <button className="w-full bg-stone-100 hover:bg-white text-stone-950 font-bold py-2.5 rounded-xl transition-all">
                        Change Password
                      </button>
                    </form>
                  </div>
                  
                  {success && <p className="text-emerald-400 text-sm text-center font-medium">{success}</p>}
                  {error && <p className="text-red-400 text-sm text-center font-medium">{error}</p>}
                </div>

                {/* Skill Tree */}
                <div className="space-y-6">
                  <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Zap size={20} className="text-amber-500" />
                      Skill Progress
                    </h2>
                    <div className="space-y-6">
                      {player.skills?.map((skill: any) => {
                        const xpToNext = skill.level * 100;
                        const progress = (skill.xp / xpToNext) * 100;
                        
                        return (
                          <div key={skill.skill_type} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-stone-800 rounded-lg border border-stone-700">
                                  {skill.skill_type === 'wood' && <Pickaxe size={14} className="text-amber-500" />}
                                  {skill.skill_type === 'mining' && <Pickaxe size={14} className="text-blue-400" />}
                                  {skill.skill_type === 'animal' && <Sword size={14} className="text-red-400" />}
                                  {skill.skill_type === 'plants' && <Leaf size={14} className="text-emerald-400" />}
                                  {skill.skill_type === 'crafting' && <Hammer size={14} className="text-purple-400" />}
                                  {skill.skill_type === 'cooking' && <Utensils size={14} className="text-orange-400" />}
                                </div>
                                <span className="text-sm font-bold capitalize">
                                  {skill.skill_type === 'wood' ? 'Woodcutting' : 
                                   skill.skill_type === 'mining' ? 'Mining' :
                                   skill.skill_type === 'animal' ? 'Hunting' :
                                   skill.skill_type === 'plants' ? 'Foraging' :
                                   skill.skill_type === 'crafting' ? 'Crafting' : 'Cooking'}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-stone-500">Lvl {skill.level}</span>
                            </div>
                            <div className="h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className={`h-full bg-gradient-to-r ${
                                  skill.skill_type === 'wood' ? 'from-amber-600 to-amber-400' :
                                  skill.skill_type === 'mining' ? 'from-blue-600 to-blue-400' :
                                  skill.skill_type === 'animal' ? 'from-red-600 to-red-400' :
                                  skill.skill_type === 'plants' ? 'from-emerald-600 to-emerald-400' :
                                  skill.skill_type === 'crafting' ? 'from-purple-600 to-purple-400' :
                                  'from-orange-600 to-orange-400'
                                }`}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-stone-600 font-medium uppercase tracking-tighter">
                              <span>{skill.xp} XP</span>
                              <span>{xpToNext} XP</span>
                            </div>
                            
                            {/* Skill Unlocks */}
                            {skill.skill_type === 'wood' && (
                              <div className="flex gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Common</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 5 ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Oak (Lvl 5)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 15 ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Rosewood (Lvl 15)</div>
                              </div>
                            )}
                            {skill.skill_type === 'mining' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Stone</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 5 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Iron (Lvl 5)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 15 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Silver (Lvl 15)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 30 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Gold (Lvl 30)</div>
                              </div>
                            )}
                            {skill.skill_type === 'animal' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Small Game</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 10 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Forest Beasts (Lvl 10)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 25 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Apex Predators (Lvl 25)</div>
                              </div>
                            )}
                            {skill.skill_type === 'plants' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Berries</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 5 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Herbs (Lvl 5)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 15 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Rare Plants (Lvl 15)</div>
                              </div>
                            )}
                            {skill.skill_type === 'crafting' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>F (Lvl 1)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 10 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>D (Lvl 10)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 25 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>C (Lvl 25)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 45 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>B (Lvl 45)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 70 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>A (Lvl 70)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 95 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>S (Lvl 95)</div>
                              </div>
                            )}
                            {skill.skill_type === 'cooking' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 1 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Common (Lvl 1)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 10 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Rare (Lvl 10)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 30 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Epic (Lvl 30)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 60 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Legendary (Lvl 60)</div>
                                <div className={`px-2 py-1 rounded-md text-[10px] border ${skill.level >= 90 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-stone-800/50 border-stone-700 text-stone-600'}`}>Master (Lvl 90)</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "shops" && (
            <motion.div 
              key="shops"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <h1 className="text-2xl font-bold">Market District</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shops.map(shop => (
                  <button 
                    key={shop.id}
                    onClick={() => openShop(shop)}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-6 text-left hover:border-amber-500/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 group-hover:text-amber-500 transition-colors">
                        <Store size={24} />
                      </div>
                      <ChevronRight className="text-stone-700 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <h3 className="font-bold text-lg">{shop.name}</h3>
                    <p className="text-xs text-stone-500 uppercase tracking-widest">{shop.category} Specialist</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "shop-detail" && selectedShop && (
            <motion.div 
              key="shop-detail"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveTab("shops")} className="text-stone-500 hover:text-stone-200">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold">{selectedShop.name}</h1>
                  <p className="text-xs text-stone-500 uppercase tracking-widest">Trading {selectedShop.category} Goods</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {shopStock.map(item => (
                  <div key={item.item_id} className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center text-stone-500">
                        {item.type === 'material' ? <Pickaxe size={18} /> : <Hammer size={18} />}
                      </div>
                      <div>
                        <h4 className="font-bold">{item.name}</h4>
                        <p className="text-[10px] text-stone-500 uppercase">{item.quantity} in stock</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Coins size={14} />
                        <span>{item.price}</span>
                      </div>
                      <button 
                        onClick={() => buyItem(item.item_id, 1)}
                        disabled={player.gold < item.price || item.quantity <= 0}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${player.gold >= item.price && item.quantity > 0 ? 'bg-amber-500 text-stone-950 hover:bg-amber-400' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 space-y-4">
                <h2 className="text-lg font-bold">Your Inventory</h2>
                <div className="grid grid-cols-1 gap-3">
                  {inventory.filter(i => i.category === selectedShop.category || i.type === 'product').map(item => (
                    <div key={item.id} className="bg-stone-900/50 border border-stone-800 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-stone-800/50 rounded-lg flex items-center justify-center text-stone-600">
                          {item.type === 'material' ? <Pickaxe size={18} /> : <Hammer size={18} />}
                        </div>
                        <div>
                          <h4 className="font-bold">{item.name}</h4>
                          <p className="text-[10px] text-stone-500 uppercase">You have {item.quantity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-stone-400 font-bold">
                          <Coins size={14} />
                          <span>{Math.floor(item.base_price * 0.8)}</span>
                        </div>
                        <button 
                          onClick={() => sellItem(item.id, 1)}
                          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs font-bold transition-all"
                        >
                          Sell 1
                        </button>
                      </div>
                    </div>
                  ))}
                  {inventory.filter(i => i.category === selectedShop.category || i.type === 'product').length === 0 && (
                    <p className="text-sm text-stone-600 italic">No items to sell to this merchant.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-stone-950/80 backdrop-blur-lg border-t border-stone-800 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} icon={<Backpack size={20} />} label="Pack" />
          <NavButton active={activeTab === "adventure"} onClick={() => setActiveTab("adventure")} icon={<Compass size={20} />} label="Adventure" />
          <NavButton active={activeTab === "crafting"} onClick={() => setActiveTab("crafting")} icon={<Hammer size={20} />} label="Craft" />
          <NavButton active={activeTab === "gathering"} onClick={() => setActiveTab("gathering")} icon={<Pickaxe size={20} />} label="Wilds" />
          <NavButton active={activeTab === "shops" || activeTab === "shop-detail"} onClick={() => setActiveTab("shops")} icon={<Store size={20} />} label="Market" />
          <NavButton active={activeTab === "character"} onClick={() => setActiveTab("character")} icon={<User size={20} />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-amber-500' : 'text-stone-500 hover:text-stone-300'}`}
  >
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);
