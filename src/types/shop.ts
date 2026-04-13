export interface ShopItem {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  item_type: 'seed' | 'tool' | 'upgrade';
  price: number;
  emoji: string | null;
  rarity: string;
  is_premium: boolean;
  effects: any;
  available: boolean;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  shop_item_id: string;
  quantity: number;
  purchased_at: string;
  shop_item?: ShopItem;
}
