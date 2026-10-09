export type Rarity = "blue" | "purple" | "pink" | "red" | "gold";
export interface Skin {
  id: string;
  name: string;
  weapon: string;
  skin: string;
  price: number;
  rarity: Rarity;
  image: string;
  rarityColor?: string;
  supplemental?: boolean;
  nameRu?: string;
}
export interface Case {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  image: string;
  imageBack?: string;
  color?: string;
  description?: string;
  enabled?: boolean;
}
export interface Item {
  uid: string;
  skinId: string;
  price: number;
  locked: boolean;
  acquired: number;
}
export interface HistoryEntry {
  id: string;
  type: string;
  label: string;
  change: number;
  time: number;
  items?: string[];
}
export interface PlayerOdds {
  caseLuck: number;
  upgradeBonus: number;
  rarityWeights: Record<Rarity, number>;
}
export interface PlayerState {
  odds?: PlayerOdds;
  balance: number;
  inventory: Item[];
  history: HistoryEntry[];
  opened: number;
  upgrades: number;
  contracts: number;
  battles: number;
  earned: number;
  spent: number;
  bonusAt: number;
  farmAt: number;
  farmHoldAt?: number;
  farmInvestment?: number;
  freeAt?: number;
  promoCodes: string[];
  achievements: string[];
  bestDrop: string | null;
}
export interface Player {
  id: string;
  name: string;
  avatar?: string;
  registered: boolean;
  banned?: boolean;
  created?: number;
  state: PlayerState;
  version?: number;
}
export interface Settings {
  startingBalance: number;
  dailyBonus: number;
  farmReward: number;
  farmCooldown: number;
  upgradeFee: number;
  contractMin: number;
  contractMax: number;
  maintenance: boolean;
  announcement: string;
  caseOverrides: Record<string, Partial<Case>>;
  odds: Record<string, Record<string, number>>;
  skinPrices: Record<string, number>;
  promos: { code: string; amount: number; enabled: boolean }[];
}
export interface CaseContent {
  skin: Skin;
  weight: number;
  chance: number;
}
export interface Bootstrap {
  player: Player;
  cases: Case[];
  skins: Skin[];
  settings: Settings;
  caseContents: Record<
    string,
    { skinId: string; price: number; weight: number; chance: number }[]
  >;
  feed: { name: string; skinId: string; time: number }[];
}
