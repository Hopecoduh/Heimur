const API_BASE = "/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const text = await response.text();
  const contentType = response.headers.get("content-type");
  
  let data = {};
  if (contentType && contentType.includes("application/json") && text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
    }
  }
  
  if (!response.ok) {
    const error = new Error((data as any).error || text || `Request failed with status ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  
  return data;
};

export const api = {
  login: (data: any) => fetch(`${API_BASE}/login`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  register: (data: any) => fetch(`${API_BASE}/register`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  getMe: () => fetch(`${API_BASE}/me?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  getItems: () => fetch(`${API_BASE}/items?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  getInventory: () => fetch(`${API_BASE}/inventory?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  getRecipes: () => fetch(`${API_BASE}/recipes?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  getTasks: () => fetch(`${API_BASE}/tasks?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  startCraft: (recipeId: number) => fetch(`${API_BASE}/craft/start`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ recipeId }) }).then(handleResponse),
  claimCraft: () => fetch(`${API_BASE}/craft/claim`, { method: "POST", headers: getHeaders() }).then(handleResponse),
  startGather: (category: string) => fetch(`${API_BASE}/gather/start`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ category }) }).then(handleResponse),
  claimGather: () => fetch(`${API_BASE}/gather/claim`, { method: "POST", headers: getHeaders() }).then(handleResponse),
  getShops: () => fetch(`${API_BASE}/shops?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  getShopStock: (id: number) => fetch(`${API_BASE}/shops/${id}/stock?_t=${Date.now()}`, { headers: getHeaders() }).then(handleResponse),
  buyItem: (data: any) => fetch(`${API_BASE}/shops/buy`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  sellItem: (data: any) => fetch(`${API_BASE}/shops/sell`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  updateProfile: (data: any) => fetch(`${API_BASE}/profile/update`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  updatePassword: (data: any) => fetch(`${API_BASE}/profile/password`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  
  // Adventure
  getAdventureTemplates: () => fetch(`${API_BASE}/adventure/templates`, { headers: getHeaders() }).then(handleResponse),
  getMonsters: () => fetch(`${API_BASE}/adventure/monsters`, { headers: getHeaders() }).then(handleResponse),
  startAdventure: (tier: string, templateId: number) => fetch(`${API_BASE}/adventure/start`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ tier, templateId }) }).then(handleResponse),
  claimAdventure: () => fetch(`${API_BASE}/adventure/claim`, { method: "POST", headers: getHeaders() }).then(handleResponse),
  
  // Guild
  getGuild: () => fetch(`${API_BASE}/guild/me`, { headers: getHeaders() }).then(handleResponse),
  createGuild: (name: string) => fetch(`${API_BASE}/guild/create`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ name }) }).then(handleResponse),
  promoteGuild: () => fetch(`${API_BASE}/guild/promote`, { method: "POST", headers: getHeaders() }).then(handleResponse),
};
