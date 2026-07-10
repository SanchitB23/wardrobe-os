export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      brands: {
        Row: { created_at: string | null; id: string; name: string };
        Insert: { created_at?: string | null; id?: string; name: string };
        Update: { created_at?: string | null; id?: string; name?: string };
        Relationships: [];
      };
      categories: {
        Row: { created_at: string | null; id: string; name: string };
        Insert: { created_at?: string | null; id?: string; name: string };
        Update: { created_at?: string | null; id?: string; name?: string };
        Relationships: [];
      };
      colors: {
        Row: {
          created_at: string | null;
          family: string | null;
          family_id: string | null;
          hex: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          family?: string | null;
          family_id?: string | null;
          hex?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          family?: string | null;
          family_id?: string | null;
          hex?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      subcategories: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      styles: {
        Row: { description: string | null; id: string; name: string };
        Insert: { description?: string | null; id?: string; name: string };
        Update: { description?: string | null; id?: string; name?: string };
        Relationships: [];
      };
      item_images: {
        Row: {
          created_at: string | null;
          id: string;
          image_type: Database["public"]["Enums"]["image_type_enum"] | null;
          image_url: string;
          is_primary: boolean | null;
          item_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          image_type?: Database["public"]["Enums"]["image_type_enum"] | null;
          image_url: string;
          is_primary?: boolean | null;
          item_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          image_type?: Database["public"]["Enums"]["image_type_enum"] | null;
          image_url?: string;
          is_primary?: boolean | null;
          item_id?: string | null;
        };
        Relationships: [];
      };
      wardrobe_items: {
        Row: {
          brand_id: string | null;
          category_id: string | null;
          code: string;
          created_at: string | null;
          favorite: boolean;
          avoided: boolean;
          protected: boolean;
          fit: Database["public"]["Enums"]["fit_type"] | null;
          formality: Database["public"]["Enums"]["formality_enum"] | null;
          formality_level: number | null;
          id: string;
          name: string;
          notes: string | null;
          ownership: Database["public"]["Enums"]["ownership_type"] | null;
          primary_color_id: string | null;
          rating: number | null;
          status: Database["public"]["Enums"]["item_status"] | null;
          subcategory_id: string | null;
          updated_at: string | null;
          usage: Database["public"]["Enums"]["usage_frequency"] | null;
        };
        Insert: {
          brand_id?: string | null;
          category_id?: string | null;
          code: string;
          created_at?: string | null;
          favorite?: boolean;
          avoided?: boolean;
          protected?: boolean;
          fit?: Database["public"]["Enums"]["fit_type"] | null;
          formality?: Database["public"]["Enums"]["formality_enum"] | null;
          formality_level?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          ownership?: Database["public"]["Enums"]["ownership_type"] | null;
          primary_color_id?: string | null;
          rating?: number | null;
          status?: Database["public"]["Enums"]["item_status"] | null;
          subcategory_id?: string | null;
          updated_at?: string | null;
          usage?: Database["public"]["Enums"]["usage_frequency"] | null;
        };
        Update: {
          brand_id?: string | null;
          category_id?: string | null;
          code?: string;
          created_at?: string | null;
          favorite?: boolean;
          avoided?: boolean;
          protected?: boolean;
          fit?: Database["public"]["Enums"]["fit_type"] | null;
          formality?: Database["public"]["Enums"]["formality_enum"] | null;
          formality_level?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          ownership?: Database["public"]["Enums"]["ownership_type"] | null;
          primary_color_id?: string | null;
          rating?: number | null;
          status?: Database["public"]["Enums"]["item_status"] | null;
          subcategory_id?: string | null;
          updated_at?: string | null;
          usage?: Database["public"]["Enums"]["usage_frequency"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_items_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_primary_color_id_fkey";
            columns: ["primary_color_id"];
            isOneToOne: false;
            referencedRelation: "colors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      materials: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      preference_overrides: {
        Row: {
          id: string;
          dimension: string;
          value: string;
          mode: string;
          weight: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dimension: string;
          value: string;
          mode: string;
          weight?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dimension?: string;
          value?: string;
          mode?: string;
          weight?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          name: string | null;
          destination: string | null;
          start_date: string;
          end_date: string;
          travel_style: string;
          planning_strategy: string;
          laundry_available: boolean;
          luggage_kind: string;
          luggage_max_items: number | null;
          notes: string | null;
          is_template: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          destination?: string | null;
          start_date: string;
          end_date: string;
          travel_style?: string;
          planning_strategy?: string;
          laundry_available?: boolean;
          luggage_kind?: string;
          luggage_max_items?: number | null;
          notes?: string | null;
          is_template?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          destination?: string | null;
          start_date?: string;
          end_date?: string;
          travel_style?: string;
          planning_strategy?: string;
          laundry_available?: boolean;
          luggage_kind?: string;
          luggage_max_items?: number | null;
          notes?: string | null;
          is_template?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_cities: {
        Row: {
          id: string;
          trip_id: string;
          city: string;
          start_date: string;
          end_date: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          trip_id: string;
          city: string;
          start_date: string;
          end_date: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          trip_id?: string;
          city?: string;
          start_date?: string;
          end_date?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      trip_events: {
        Row: {
          id: string;
          trip_id: string;
          event_date: string;
          occasion: string;
          formality_hint: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          event_date: string;
          occasion: string;
          formality_hint?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          event_date?: string;
          occasion?: string;
          formality_hint?: string | null;
        };
        Relationships: [];
      };
      trip_packing_progress: {
        Row: {
          id: string;
          trip_id: string;
          item_id: string;
          packed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          item_id: string;
          packed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          item_id?: string;
          packed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      features: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      tags: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      occasions: {
        Row: { description: string | null; id: string; name: string };
        Insert: { description?: string | null; id?: string; name: string };
        Update: { description?: string | null; id?: string; name?: string };
        Relationships: [];
      };
      storage_types: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      item_materials: {
        Row: { item_id: string; material_id: string };
        Insert: { item_id: string; material_id: string };
        Update: { item_id?: string; material_id?: string };
        Relationships: [];
      };
      item_seasons: {
        Row: { item_id: string; season_id: string };
        Insert: { item_id: string; season_id: string };
        Update: { item_id?: string; season_id?: string };
        Relationships: [];
      };
      item_styles: {
        Row: { item_id: string; style_id: string };
        Insert: { item_id: string; style_id: string };
        Update: { item_id?: string; style_id?: string };
        Relationships: [];
      };
      item_features: {
        Row: { item_id: string; feature_id: string };
        Insert: { item_id: string; feature_id: string };
        Update: { item_id?: string; feature_id?: string };
        Relationships: [];
      };
      item_tags: {
        Row: { item_id: string; tag_id: string };
        Insert: { item_id: string; tag_id: string };
        Update: { item_id?: string; tag_id?: string };
        Relationships: [];
      };
      item_occasions: {
        Row: {
          id: string;
          item_id: string | null;
          occasion_id: string | null;
          notes: string | null;
          score: number | null;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          occasion_id?: string | null;
          notes?: string | null;
          score?: number | null;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          occasion_id?: string | null;
          notes?: string | null;
          score?: number | null;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          created_at: string | null;
          id: string;
          item_id: string;
          price: number;
          purchase_date: string;
          return_reason: string | null;
          source: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          item_id: string;
          price: number;
          purchase_date: string;
          return_reason?: string | null;
          source?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          item_id?: string;
          price?: number;
          purchase_date?: string;
          return_reason?: string | null;
          source?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      outfits: {
        Row: {
          created_at: string | null;
          favorite: boolean;
          id: string;
          name: string;
          notes: string | null;
          occasion_id: string | null;
          rating: number | null;
          season: string | null;
          weather_notes: string | null;
        };
        Insert: {
          created_at?: string | null;
          favorite?: boolean;
          id?: string;
          name: string;
          notes?: string | null;
          occasion_id?: string | null;
          rating?: number | null;
          season?: string | null;
          weather_notes?: string | null;
        };
        Update: {
          created_at?: string | null;
          favorite?: boolean;
          id?: string;
          name?: string;
          notes?: string | null;
          occasion_id?: string | null;
          rating?: number | null;
          season?: string | null;
          weather_notes?: string | null;
        };
        Relationships: [];
      };
      outfit_items: {
        Row: {
          item_id: string;
          outfit_id: string;
          role: string;
        };
        Insert: {
          item_id: string;
          outfit_id: string;
          role: string;
        };
        Update: {
          item_id?: string;
          outfit_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      wear_logs: {
        Row: {
          comfort_rating: number | null;
          created_at: string | null;
          id: string;
          item_id: string;
          notes: string | null;
          occasion_id: string | null;
          outfit_id: string | null;
          worn_on: string;
        };
        Insert: {
          comfort_rating?: number | null;
          created_at?: string | null;
          id?: string;
          item_id: string;
          notes?: string | null;
          occasion_id?: string | null;
          outfit_id?: string | null;
          worn_on: string;
        };
        Update: {
          comfort_rating?: number | null;
          created_at?: string | null;
          id?: string;
          item_id?: string;
          notes?: string | null;
          occasion_id?: string | null;
          outfit_id?: string | null;
          worn_on?: string;
        };
        Relationships: [];
      };
      care_profiles: {
        Row: {
          item_id: string;
          notes: string | null;
          storage: string | null;
          storage_type_id: string | null;
          wash: string | null;
        };
        Insert: {
          item_id: string;
          notes?: string | null;
          storage?: string | null;
          storage_type_id?: string | null;
          wash?: string | null;
        };
        Update: {
          item_id?: string;
          notes?: string | null;
          storage?: string | null;
          storage_type_id?: string | null;
          wash?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      fit_type: "slim" | "regular" | "relaxed" | "oversized" | "unknown";
      formality_enum:
        | "casual"
        | "smart_casual"
        | "business_casual"
        | "business_formal"
        | "formal";
      item_status: "active" | "retired" | "returned";
      ownership_type: "owned" | "wishlist" | "considering";
      usage_frequency: "rare" | "occasional" | "regular" | "frequent" | "hero";
      image_type_enum:
        | "product"
        | "flatlay"
        | "hanger"
        | "worn"
        | "closeup"
        | "label";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;
