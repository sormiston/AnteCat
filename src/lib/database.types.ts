export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      order_item_stakes: {
        Row: {
          order_item_id: number
          stake_amount_cents: number
          stake_id: number
          stake_qty: number
          user_id: string
        }
        Insert: {
          order_item_id: number
          stake_amount_cents: number
          stake_id?: number
          stake_qty: number
          user_id: string
        }
        Update: {
          order_item_id?: number
          stake_amount_cents?: number
          stake_id?: number
          stake_qty?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_stakes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_item_resolution"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_stakes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["order_item_id"]
          },
        ]
      }
      order_items: {
        Row: {
          max_quantity: number | null
          order_id: number
          order_item_id: number
          product_id: number
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          max_quantity?: number | null
          order_id: number
          order_item_id?: number
          product_id: number
          quantity?: number
          unit_price_cents: number
        }
        Update: {
          max_quantity?: number | null
          order_id?: number
          order_item_id?: number
          product_id?: number
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          deadline_at: string
          executed_at: string | null
          opened_at: string
          order_id: number
          status: string
          syndicate_id: number
        }
        Insert: {
          closed_at?: string | null
          deadline_at: string
          executed_at?: string | null
          opened_at?: string
          order_id?: number
          status?: string
          syndicate_id: number
        }
        Update: {
          closed_at?: string | null
          deadline_at?: string
          executed_at?: string | null
          opened_at?: string
          order_id?: number
          status?: string
          syndicate_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicates"
            referencedColumns: ["syndicate_id"]
          },
        ]
      }
      product_bundle_thresholds: {
        Row: {
          bundle_price_cents: number
          product_id: number
          threshold_qty: number
        }
        Insert: {
          bundle_price_cents: number
          product_id: number
          threshold_qty: number
        }
        Update: {
          bundle_price_cents?: number
          product_id?: number
          threshold_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_bundle_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_price_tier_plans: {
        Row: {
          product_id: number
          tiers: Json
        }
        Insert: {
          product_id: number
          tiers: Json
        }
        Update: {
          product_id?: number
          tiers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tier_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          name: string
          pricing_type: string
          product_id: number
          qty_step: number
          unit_of_quantity: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          name: string
          pricing_type: string
          product_id?: number
          qty_step: number
          unit_of_quantity: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          name?: string
          pricing_type?: string
          product_id?: number
          qty_step?: number
          unit_of_quantity?: string
        }
        Relationships: []
      }
      syndicate_members: {
        Row: {
          joined_at: string
          syndicate_id: number
          user_id: string
        }
        Insert: {
          joined_at?: string
          syndicate_id: number
          user_id: string
        }
        Update: {
          joined_at?: string
          syndicate_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndicate_members_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicates"
            referencedColumns: ["syndicate_id"]
          },
        ]
      }
      syndicates: {
        Row: {
          admin_user_id: string
          name: string
          syndicate_id: number
        }
        Insert: {
          admin_user_id: string
          name: string
          syndicate_id?: number
        }
        Update: {
          admin_user_id?: string
          name?: string
          syndicate_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      order_item_resolution: {
        Row: {
          order_item_id: number | null
          resolution_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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

