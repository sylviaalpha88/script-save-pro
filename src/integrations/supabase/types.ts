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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accountant_reports: {
        Row: {
          cash: number
          created_at: string
          created_by: string | null
          id: string
          mpesa: number
          notes: string | null
          pharmacy_id: string | null
          report_date: string
          total: number
          updated_at: string
        }
        Insert: {
          cash?: number
          created_at?: string
          created_by?: string | null
          id?: string
          mpesa?: number
          notes?: string | null
          pharmacy_id?: string | null
          report_date?: string
          total?: number
          updated_at?: string
        }
        Update: {
          cash?: number
          created_at?: string
          created_by?: string | null
          id?: string
          mpesa?: number
          notes?: string | null
          pharmacy_id?: string | null
          report_date?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_reports_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      drugs: {
        Row: {
          buying_price: number
          created_at: string
          id: string
          min_stock: number
          name: string
          pharmacy_id: string | null
          selling_price: number
          selling_price_retail: number
          selling_price_wholesale: number
          stock_quantity: number
          unit: Database["public"]["Enums"]["drug_unit"]
          updated_at: string
          wholesale_min_qty: number
        }
        Insert: {
          buying_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          pharmacy_id?: string | null
          selling_price?: number
          selling_price_retail?: number
          selling_price_wholesale?: number
          stock_quantity?: number
          unit?: Database["public"]["Enums"]["drug_unit"]
          updated_at?: string
          wholesale_min_qty?: number
        }
        Update: {
          buying_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          pharmacy_id?: string | null
          selling_price?: number
          selling_price_retail?: number
          selling_price_wholesale?: number
          stock_quantity?: number
          unit?: Database["public"]["Enums"]["drug_unit"]
          updated_at?: string
          wholesale_min_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "drugs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          created_at: string
          id: string
          name: string
          patient_code: string | null
          pharmacy_id: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          id?: string
          name: string
          patient_code?: string | null
          pharmacy_id?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          id?: string
          name?: string
          patient_code?: string | null
          pharmacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_edit_site: boolean
          created_at: string
          id: string
          is_director: boolean
          pharmacy_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Insert: {
          can_edit_site?: boolean
          created_at?: string
          id: string
          is_director?: boolean
          pharmacy_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Update: {
          can_edit_site?: boolean
          created_at?: string
          id?: string
          is_director?: boolean
          pharmacy_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          drug_id: string
          drug_name: string
          id: string
          pharmacy_id: string | null
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          drug_id: string
          drug_name: string
          id?: string
          pharmacy_id?: string | null
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          drug_id?: string
          drug_name?: string
          id?: string
          pharmacy_id?: string | null
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          patient_id: string | null
          payment_method: string | null
          pharmacy_id: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          total: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          patient_id?: string | null
          payment_method?: string | null
          pharmacy_id?: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          total?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          patient_id?: string | null
          payment_method?: string | null
          pharmacy_id?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          body: string
          image_url: string | null
          section: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          image_url?: string | null
          section: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          image_url?: string | null
          section?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_public_site: { Args: { _uid: string }; Returns: boolean }
      current_pharmacy_id: { Args: never; Returns: string }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_director: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "pharmacy" | "inventory" | "accountant"
      drug_unit: "tab" | "cap" | "piece"
      sale_type: "retail" | "wholesale"
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
    Enums: {
      app_role: ["admin", "pharmacy", "inventory", "accountant"],
      drug_unit: ["tab", "cap", "piece"],
      sale_type: ["retail", "wholesale"],
    },
  },
} as const
