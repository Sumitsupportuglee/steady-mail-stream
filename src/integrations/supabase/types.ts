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
      business_directory: {
        Row: {
          address: string | null
          business_name: string | null
          client_id: string | null
          created_at: string
          emails: string[]
          id: string
          phones: string[]
          search_id: string | null
          source_url: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          client_id?: string | null
          created_at?: string
          emails?: string[]
          id?: string
          phones?: string[]
          search_id?: string | null
          source_url?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          client_id?: string | null
          created_at?: string
          emails?: string[]
          id?: string
          phones?: string[]
          search_id?: string | null
          source_url?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_directory_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_directory_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string | null
          client_id: string | null
          created_at: string | null
          id: string
          recipient_count: number | null
          sender_identity_id: string | null
          status: Database["public"]["Enums"]["campaign_status_type"] | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_html?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          sender_identity_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status_type"] | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_html?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          sender_identity_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status_type"] | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sender_identity_id_fkey"
            columns: ["sender_identity_id"]
            isOneToOne: false
            referencedRelation: "sender_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          smtp_encryption: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          status: Database["public"]["Enums"]["contact_status_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          status?: Database["public"]["Enums"]["contact_status_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          status?: Database["public"]["Enums"]["contact_status_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          client_id: string | null
          company: string | null
          contact_id: string | null
          created_at: string
          deal_value: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          position: number
          stage: Database["public"]["Enums"]["crm_stage_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          position?: number
          stage?: Database["public"]["Enums"]["crm_stage_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          position?: number
          stage?: Database["public"]["Enums"]["crm_stage_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_clicks: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          email_queue_id: string
          id: string
          ip_address: string | null
          original_url: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          email_queue_id: string
          id?: string
          ip_address?: string | null
          original_url: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          email_queue_id?: string
          id?: string
          ip_address?: string | null
          original_url?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_clicks_email_queue_id_fkey"
            columns: ["email_queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_opens: {
        Row: {
          campaign_id: string
          email_queue_id: string
          id: string
          ip_address: string | null
          opened_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          email_queue_id: string
          id?: string
          ip_address?: string | null
          opened_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          email_queue_id?: string
          id?: string
          ip_address?: string | null
          opened_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_opens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_opens_email_queue_id_fkey"
            columns: ["email_queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_opens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempt_count: number | null
          body: string
          campaign_id: string
          contact_id: string
          created_at: string | null
          error_log: string | null
          from_email: string
          id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status_type"] | null
          subject: string
          to_email: string
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          body: string
          campaign_id: string
          contact_id: string
          created_at?: string | null
          error_log?: string | null
          from_email: string
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_type"] | null
          subject: string
          to_email: string
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          body?: string
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          error_log?: string | null
          from_email?: string
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_type"] | null
          subject?: string
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          lead_limit: number
          mode: string
          query: string
          results_count: number
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          lead_limit?: number
          mode?: string
          query: string
          results_count?: number
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          lead_limit?: number
          mode?: string
          query?: string
          results_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_searches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      master_business_directory: {
        Row: {
          address: string | null
          business_name: string | null
          contributed_by: string
          created_at: string
          emails: string[]
          id: string
          phones: string[]
          search_query: string | null
          source_url: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          contributed_by: string
          created_at?: string
          emails?: string[]
          id?: string
          phones?: string[]
          search_query?: string | null
          source_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          contributed_by?: string
          created_at?: string
          emails?: string[]
          id?: string
          phones?: string[]
          search_query?: string | null
          source_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          daily_send_limit: number | null
          email_credits: number | null
          emails_sent_this_hour: number | null
          emails_sent_today: number | null
          hourly_send_limit: number | null
          id: string
          is_approved: boolean | null
          last_daily_reset: string | null
          last_hourly_reset: string | null
          organization_name: string | null
          smtp_encryption: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          tier: Database["public"]["Enums"]["tier_type"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_send_limit?: number | null
          email_credits?: number | null
          emails_sent_this_hour?: number | null
          emails_sent_today?: number | null
          hourly_send_limit?: number | null
          id: string
          is_approved?: boolean | null
          last_daily_reset?: string | null
          last_hourly_reset?: string | null
          organization_name?: string | null
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          tier?: Database["public"]["Enums"]["tier_type"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_send_limit?: number | null
          email_credits?: number | null
          emails_sent_this_hour?: number | null
          emails_sent_today?: number | null
          hourly_send_limit?: number | null
          id?: string
          is_approved?: boolean | null
          last_daily_reset?: string | null
          last_hourly_reset?: string | null
          organization_name?: string | null
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          tier?: Database["public"]["Enums"]["tier_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          rating: number
          review_text: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review_text: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review_text?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      sender_identities: {
        Row: {
          client_id: string | null
          created_at: string | null
          dkim_record: string | null
          domain_status:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          from_email: string
          from_name: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          dkim_record?: string | null
          domain_status?:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          from_email: string
          from_name: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          dkim_record?: string | null
          domain_status?:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          from_email?: string
          from_name?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sender_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sender_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan_type"]
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan_type"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan_type"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_status_type: "draft" | "queued" | "sending" | "completed"
      contact_status_type: "active" | "bounced" | "unsubscribed"
      crm_stage_type:
        | "new_lead"
        | "contacted"
        | "interested"
        | "meeting_scheduled"
        | "closed"
      domain_status_type: "unverified" | "verified"
      email_status_type: "pending" | "sent" | "failed"
      subscription_plan_type: "monthly" | "yearly"
      subscription_status_type: "active" | "expired" | "cancelled" | "pending"
      tier_type: "starter" | "growth"
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
      app_role: ["admin", "user"],
      campaign_status_type: ["draft", "queued", "sending", "completed"],
      contact_status_type: ["active", "bounced", "unsubscribed"],
      crm_stage_type: [
        "new_lead",
        "contacted",
        "interested",
        "meeting_scheduled",
        "closed",
      ],
      domain_status_type: ["unverified", "verified"],
      email_status_type: ["pending", "sent", "failed"],
      subscription_plan_type: ["monthly", "yearly"],
      subscription_status_type: ["active", "expired", "cancelled", "pending"],
      tier_type: ["starter", "growth"],
    },
  },
} as const
