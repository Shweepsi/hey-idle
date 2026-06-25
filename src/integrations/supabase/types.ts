export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_effects: {
        Row: {
          created_at: string
          effect_type: string
          effect_value: number
          expires_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effect_type: string
          effect_value?: number
          expires_at: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          effect_type?: string
          effect_value?: number
          expires_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_cooldowns: {
        Row: {
          created_at: string
          daily_count: number
          daily_reset_date: string
          fixed_cooldown_duration: number | null
          id: string
          last_ad_watched: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_count?: number
          daily_reset_date?: string
          fixed_cooldown_duration?: number | null
          id?: string
          last_ad_watched?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_count?: number
          daily_reset_date?: string
          fixed_cooldown_duration?: number | null
          id?: string
          last_ad_watched?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_reward_configs: {
        Row: {
          active: boolean | null
          base_amount: number
          created_at: string | null
          description: string
          display_name: string
          duration_minutes: number | null
          emoji: string | null
          id: string
          level_coefficient: number | null
          max_amount: number | null
          min_player_level: number | null
          reward_type: string
        }
        Insert: {
          active?: boolean | null
          base_amount: number
          created_at?: string | null
          description: string
          display_name: string
          duration_minutes?: number | null
          emoji?: string | null
          id?: string
          level_coefficient?: number | null
          max_amount?: number | null
          min_player_level?: number | null
          reward_type: string
        }
        Update: {
          active?: boolean | null
          base_amount?: number
          created_at?: string | null
          description?: string
          display_name?: string
          duration_minutes?: number | null
          emoji?: string | null
          id?: string
          level_coefficient?: number | null
          max_amount?: number | null
          min_player_level?: number | null
          reward_type?: string
        }
        Relationships: []
      }
      ad_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          reward_amount: number
          reward_data: Json | null
          reward_type: string
          user_id: string
          watched_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          reward_amount: number
          reward_data?: Json | null
          reward_type: string
          user_id: string
          watched_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          reward_amount?: number
          reward_data?: Json | null
          reward_type?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: number
          meta: Json
          target_key: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: number
          meta?: Json
          target_key?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: number
          meta?: Json
          target_key?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          notes: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          notes?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          notes?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reward_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          reward_boost_minutes: number | null
          reward_boost_type: string | null
          reward_boost_value: number | null
          reward_coins: number
          reward_gems: number
          streak_day: number
          user_id: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          id?: string
          reward_boost_minutes?: number | null
          reward_boost_type?: string | null
          reward_boost_value?: number | null
          reward_coins?: number
          reward_gems?: number
          streak_day: number
          user_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          reward_boost_minutes?: number | null
          reward_boost_type?: string | null
          reward_boost_value?: number | null
          reward_coins?: number
          reward_gems?: number
          streak_day?: number
          user_id?: string
        }
        Relationships: []
      }
      economy_configs: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      economy_events: {
        Row: {
          coins_delta: number
          created_at: string
          essence_delta: number
          event_type: string
          gems_delta: number
          id: number
          meta: Json
          user_id: string
        }
        Insert: {
          coins_delta?: number
          created_at?: string
          essence_delta?: number
          event_type: string
          gems_delta?: number
          id?: number
          meta?: Json
          user_id: string
        }
        Update: {
          coins_delta?: number
          created_at?: string
          essence_delta?: number
          event_type?: string
          gems_delta?: number
          id?: number
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      essence_upgrades: {
        Row: {
          cost_base: number
          cost_per_level: number
          created_at: string
          description: string
          display_name: string
          effect_per_level: number
          emoji: string
          id: string
          max_level: number
          sort_order: number
        }
        Insert: {
          cost_base: number
          cost_per_level: number
          created_at?: string
          description: string
          display_name: string
          effect_per_level: number
          emoji: string
          id: string
          max_level: number
          sort_order?: number
        }
        Update: {
          cost_base?: number
          cost_per_level?: number
          created_at?: string
          description?: string
          display_name?: string
          effect_per_level?: number
          emoji?: string
          id?: string
          max_level?: number
          sort_order?: number
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          rollout_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      garden_plots: {
        Row: {
          created_at: string
          growth_time_seconds: number | null
          id: string
          plant_metadata: Json | null
          plant_type: string | null
          planted_at: string | null
          plot_number: number
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          growth_time_seconds?: number | null
          id?: string
          plant_metadata?: Json | null
          plant_type?: string | null
          planted_at?: string | null
          plot_number: number
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          growth_time_seconds?: number | null
          id?: string
          plant_metadata?: Json | null
          plant_type?: string | null
          planted_at?: string | null
          plot_number?: number
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garden_plots_plant_type_fkey"
            columns: ["plant_type"]
            isOneToOne: false
            referencedRelation: "plant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      level_upgrades: {
        Row: {
          cost_coins: number
          cost_gems: number
          created_at: string | null
          description: string
          display_name: string
          effect_type: string
          effect_value: number
          emoji: string | null
          id: string
          level_required: number
          name: string
        }
        Insert: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string | null
          description: string
          display_name: string
          effect_type: string
          effect_value?: number
          emoji?: string | null
          id?: string
          level_required: number
          name: string
        }
        Update: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string | null
          description?: string
          display_name?: string
          effect_type?: string
          effect_value?: number
          emoji?: string | null
          id?: string
          level_required?: number
          name?: string
        }
        Relationships: []
      }
      plant_discoveries: {
        Row: {
          discovered_at: string | null
          discovery_method: string | null
          id: string
          plant_type_id: string
          rarity_bonus: number | null
          user_id: string
        }
        Insert: {
          discovered_at?: string | null
          discovery_method?: string | null
          id?: string
          plant_type_id: string
          rarity_bonus?: number | null
          user_id: string
        }
        Update: {
          discovered_at?: string | null
          discovery_method?: string | null
          id?: string
          plant_type_id?: string
          rarity_bonus?: number | null
          user_id?: string
        }
        Relationships: []
      }
      plant_types: {
        Row: {
          base_growth_seconds: number
          created_at: string
          display_name: string
          emoji: string | null
          id: string
          level_required: number | null
          name: string
          rarity: string | null
        }
        Insert: {
          base_growth_seconds?: number
          created_at?: string
          display_name: string
          emoji?: string | null
          id?: string
          level_required?: number | null
          name: string
          rarity?: string | null
        }
        Update: {
          base_growth_seconds?: number
          created_at?: string
          display_name?: string
          emoji?: string | null
          id?: string
          level_required?: number | null
          name?: string
          rarity?: string | null
        }
        Relationships: []
      }
      player_achievements: {
        Row: {
          achievement_category: string
          achievement_name: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_category: string
          achievement_name: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          target: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_category?: string
          achievement_name?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_essence_upgrades: {
        Row: {
          id: string
          level: number
          purchased_at: string
          updated_at: string
          upgrade_id: string
          user_id: string
        }
        Insert: {
          id?: string
          level?: number
          purchased_at?: string
          updated_at?: string
          upgrade_id: string
          user_id: string
        }
        Update: {
          id?: string
          level?: number
          purchased_at?: string
          updated_at?: string
          upgrade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_essence_upgrades_upgrade_id_fkey"
            columns: ["upgrade_id"]
            isOneToOne: false
            referencedRelation: "essence_upgrades"
            referencedColumns: ["id"]
          },
        ]
      }
      player_gardens: {
        Row: {
          active_plot: number
          coins: number
          coins_earned_this_run: number
          created_at: string
          daily_streak: number
          economy_version: number
          essence: number
          experience: number | null
          gems: number | null
          highest_prestige: number
          id: string
          last_daily_claim_date: string | null
          last_played: string
          level: number | null
          permanent_multiplier: number | null
          premium_purchased_at: string | null
          premium_status: boolean | null
          prestige_level: number | null
          prestige_points: number | null
          robot_accumulated_coins: number | null
          robot_last_collected: string | null
          robot_level: number
          robot_plant_type: string | null
          total_coins_earned: number
          total_harvests: number
          user_id: string
        }
        Insert: {
          active_plot?: number
          coins?: number
          coins_earned_this_run?: number
          created_at?: string
          daily_streak?: number
          economy_version?: number
          essence?: number
          experience?: number | null
          gems?: number | null
          highest_prestige?: number
          id?: string
          last_daily_claim_date?: string | null
          last_played?: string
          level?: number | null
          permanent_multiplier?: number | null
          premium_purchased_at?: string | null
          premium_status?: boolean | null
          prestige_level?: number | null
          prestige_points?: number | null
          robot_accumulated_coins?: number | null
          robot_last_collected?: string | null
          robot_level?: number
          robot_plant_type?: string | null
          total_coins_earned?: number
          total_harvests?: number
          user_id: string
        }
        Update: {
          active_plot?: number
          coins?: number
          coins_earned_this_run?: number
          created_at?: string
          daily_streak?: number
          economy_version?: number
          essence?: number
          experience?: number | null
          gems?: number | null
          highest_prestige?: number
          id?: string
          last_daily_claim_date?: string | null
          last_played?: string
          level?: number | null
          permanent_multiplier?: number | null
          premium_purchased_at?: string | null
          premium_status?: boolean | null
          prestige_level?: number | null
          prestige_points?: number | null
          robot_accumulated_coins?: number | null
          robot_last_collected?: string | null
          robot_level?: number
          robot_plant_type?: string | null
          total_coins_earned?: number
          total_harvests?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_gardens_robot_plant_type_fkey"
            columns: ["robot_plant_type"]
            isOneToOne: false
            referencedRelation: "plant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      player_upgrades: {
        Row: {
          active: boolean
          id: string
          purchased_at: string | null
          upgrade_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          purchased_at?: string | null
          upgrade_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          id?: string
          purchased_at?: string | null
          upgrade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_upgrades_upgrade_id_fkey"
            columns: ["upgrade_id"]
            isOneToOne: false
            referencedRelation: "level_upgrades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          product_type: string
          reward_data: Json | null
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          product_type?: string
          reward_data?: Json | null
          status?: string
          stripe_session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          product_type?: string
          reward_data?: Json | null
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scheduled_events: {
        Row: {
          active: boolean
          banner_message: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          event_type: string
          id: string
          multiplier: number
          name: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          banner_message?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          event_type: string
          id?: string
          multiplier?: number
          name: string
          starts_at: string
        }
        Update: {
          active?: boolean
          banner_message?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          multiplier?: number
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _admin_require: { Args: never; Returns: string }
      _essence_effects: {
        Args: { p_user_id: string }
        Returns: {
          essence_earn_bonus: number
          gem_chance_bonus: number
          growth_bonus: number
          harvest_bonus: number
          offline_extra_hours: number
          robot_bonus: number
          start_coins_bonus: number
          start_plots_bonus: number
        }[]
      }
      _level_milestone_gems: {
        Args: { p_new: number; p_old: number }
        Returns: number
      }
      _override_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      _override_num: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      admin_add_admin: {
        Args: { p_notes?: string; p_role?: string; p_target_user_id: string }
        Returns: Json
      }
      admin_create_event: {
        Args: {
          p_banner_message: string
          p_ends_at: string
          p_event_type: string
          p_multiplier: number
          p_name: string
          p_starts_at: string
        }
        Returns: Json
      }
      admin_delete_event: { Args: { p_id: string }; Returns: Json }
      admin_get_audit_log: {
        Args: { p_action_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_get_economy_health: { Args: never; Returns: Json }
      admin_get_player_detail: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_grant_currency: {
        Args: {
          p_coins: number
          p_essence: number
          p_gems: number
          p_reason: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_list_admins: { Args: never; Returns: Json }
      admin_remove_admin: { Args: { p_target_user_id: string }; Returns: Json }
      admin_reset_economy_overrides: { Args: never; Returns: Json }
      admin_reset_player: {
        Args: { p_reason: string; p_target_user_id: string }
        Returns: Json
      }
      admin_search_players: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: Json
      }
      admin_toggle_feature_flag: {
        Args: { p_enabled: boolean; p_key: string; p_rollout_percent?: number }
        Returns: Json
      }
      admin_update_economy_config: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      claim_achievement_atomic: {
        Args: { p_achievement_name: string; p_user_id: string }
        Returns: Json
      }
      claim_daily_reward: { Args: { p_user_id: string }; Returns: Json }
      cleanup_expired_effects: { Args: never; Returns: undefined }
      collect_robot_income_atomic: {
        Args: { p_user_id: string }
        Returns: Json
      }
      delete_user_data: { Args: { target_user_id: string }; Returns: undefined }
      execute_prestige: { Args: { p_user_id: string }; Returns: Json }
      get_economy_snapshot: { Args: { p_user_id: string }; Returns: Json }
      get_leaderboard_coins: {
        Args: { p_limit?: number }
        Returns: {
          coins: number
          created_at: string
          premium_status: boolean
          user_id: string
          username: string
        }[]
      }
      get_leaderboard_harvests: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          premium_status: boolean
          total_harvests: number
          user_id: string
          username: string
        }[]
      }
      get_leaderboard_level: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          experience: number
          level: number
          premium_status: boolean
          user_id: string
          username: string
        }[]
      }
      get_plot_unlock_cost: { Args: { plot_number: number }; Returns: number }
      get_robot_plant_for_level: {
        Args: { robot_level: number }
        Returns: string
      }
      get_user_coins_rank: { Args: { target_user_id: string }; Returns: number }
      get_user_harvest_rank: {
        Args: { target_user_id: string }
        Returns: number
      }
      get_user_level_rank: { Args: { target_user_id: string }; Returns: number }
      harvest_plant_transaction: {
        Args: { p_plot_number: number; p_user_id: string }
        Returns: Json
      }
      increment_ad_count_atomic: {
        Args: {
          p_max_ads?: number
          p_now: string
          p_today: string
          p_user_id: string
        }
        Returns: Json
      }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_superadmin: { Args: { p_user_id: string }; Returns: boolean }
      plant_direct_atomic: {
        Args: {
          p_plant_type_id: string
          p_plot_number: number
          p_user_id: string
        }
        Returns: Json
      }
      purchase_essence_upgrade: {
        Args: { p_upgrade_id: string; p_user_id: string }
        Returns: Json
      }
      purchase_upgrade_atomic: {
        Args: { p_upgrade_id: string; p_user_id: string }
        Returns: Json
      }
      request_account_deletion: { Args: { user_email: string }; Returns: Json }
      unlock_plot_atomic: {
        Args: { p_plot_number: number; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
