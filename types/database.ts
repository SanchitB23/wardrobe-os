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
      wardrobe_items: {
        Row: {
          brand_id: string | null;
          category_id: string | null;
          code: string;
          created_at: string | null;
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
