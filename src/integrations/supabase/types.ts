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
      accounts: {
        Row: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number
          created_at: string
          currency: string
          id: string
          is_frozen: boolean
          user_id: string
        }
        Insert: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_frozen?: boolean
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_frozen?: boolean
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      atc_requests: {
        Row: {
          account_id: string
          admin_note: string | null
          amount: number
          code: string | null
          created_at: string
          expires_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          used: boolean
          used_by_transfer_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          admin_note?: string | null
          amount: number
          code?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          used?: boolean
          used_by_transfer_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          admin_note?: string | null
          amount?: number
          code?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          used?: boolean
          used_by_transfer_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          payee_id: string
          recurring: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["tx_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          payee_id: string
          recurring?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["tx_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          payee_id?: string
          recurring?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["tx_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "payees"
            referencedColumns: ["id"]
          },
        ]
      }
      card_requests: {
        Row: {
          account_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          account_id: string
          card_number: string
          cardholder_name: string
          created_at: string
          cvv: string
          expiry_month: number
          expiry_year: number
          id: string
          is_frozen: boolean
          spending_limit: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          card_number: string
          cardholder_name: string
          created_at?: string
          cvv: string
          expiry_month: number
          expiry_year: number
          id?: string
          is_frozen?: boolean
          spending_limit?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          card_number?: string
          cardholder_name?: string
          created_at?: string
          cvv?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_frozen?: boolean
          spending_limit?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_requests: {
        Row: {
          account_id: string
          admin_note: string | null
          amount: number
          check_image_url: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          admin_note?: string | null
          amount: number
          check_image_url?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          admin_note?: string | null
          amount?: number
          check_image_url?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          duration_months: number
          id: string
          purpose: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          duration_months?: number
          id?: string
          purpose?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          duration_months?: number
          id?: string
          purpose?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      login_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      payees: {
        Row: {
          account_number: string
          category: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          account_number: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          account_number?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          kyc_reason: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          ssn: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          kyc_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          ssn?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          kyc_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          ssn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_role: Database["public"]["Enums"]["support_role"] | null
          status: Database["public"]["Enums"]["support_status"]
          unread_for_admin: boolean
          unread_for_user: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_role?: Database["public"]["Enums"]["support_role"] | null
          status?: Database["public"]["Enums"]["support_status"]
          unread_for_admin?: boolean
          unread_for_user?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_role?: Database["public"]["Enums"]["support_role"] | null
          status?: Database["public"]["Enums"]["support_status"]
          unread_for_admin?: boolean
          unread_for_user?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["support_role"]
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["support_role"]
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["support_role"]
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          counterparty: string | null
          created_at: string
          description: string | null
          id: string
          reference: string
          related_tx_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after?: number | null
          counterparty?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string
          related_tx_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          counterparty?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string
          related_tx_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_tx_id_fkey"
            columns: ["related_tx_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          admin_note: string | null
          amount: number
          atc_request_id: string | null
          created_at: string
          external_account_number: string | null
          external_recipient_name: string | null
          external_routing_number: string | null
          from_account_id: string
          id: string
          is_external: boolean
          memo: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          to_account_id: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          atc_request_id?: string | null
          created_at?: string
          external_account_number?: string | null
          external_recipient_name?: string | null
          external_routing_number?: string | null
          from_account_id: string
          id?: string
          is_external?: boolean
          memo?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_account_id?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          atc_request_id?: string | null
          created_at?: string
          external_account_number?: string | null
          external_recipient_name?: string | null
          external_routing_number?: string | null
          from_account_id?: string
          id?: string
          is_external?: boolean
          memo?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_internal_transfer: {
        Args: { _amount: number; _from: string; _memo: string; _to: string }
        Returns: string
      }
      gen_account_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      post_transaction: {
        Args: {
          _account_id: string
          _allow_negative?: boolean
          _amount: number
          _counterparty?: string
          _description?: string
          _related_tx_id?: string
          _type: Database["public"]["Enums"]["tx_type"]
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "checking" | "savings"
      app_role: "admin" | "customer"
      kyc_status: "pending" | "approved" | "rejected" | "frozen"
      request_status: "pending" | "approved" | "rejected"
      support_role: "user" | "ai" | "agent"
      support_status: "ai" | "live" | "closed"
      tx_status:
        | "pending"
        | "approved"
        | "completed"
        | "rejected"
        | "reversed"
        | "failed"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "reversal"
        | "bill_payment"
        | "card_purchase"
        | "fee"
        | "interest"
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
      account_type: ["checking", "savings"],
      app_role: ["admin", "customer"],
      kyc_status: ["pending", "approved", "rejected", "frozen"],
      request_status: ["pending", "approved", "rejected"],
      support_role: ["user", "ai", "agent"],
      support_status: ["ai", "live", "closed"],
      tx_status: [
        "pending",
        "approved",
        "completed",
        "rejected",
        "reversed",
        "failed",
      ],
      tx_type: [
        "deposit",
        "withdrawal",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "reversal",
        "bill_payment",
        "card_purchase",
        "fee",
        "interest",
      ],
    },
  },
} as const
