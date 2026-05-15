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
      app_updates: {
        Row: {
          created_at: string
          description: string
          id: string
          title: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          title: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          title?: string
          version?: string | null
        }
        Relationships: []
      }
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
          smtp_rotation_pool: string[] | null
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
          smtp_rotation_pool?: string[] | null
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
          smtp_rotation_pool?: string[] | null
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
      contact_categories: {
        Row: {
          client_id: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          category_id: string | null
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
          category_id?: string | null
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
          category_id?: string | null
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
          scheduled_for: string | null
          sender_identity_id: string | null
          sent_at: string | null
          smtp_account_id: string | null
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
          scheduled_for?: string | null
          sender_identity_id?: string | null
          sent_at?: string | null
          smtp_account_id?: string | null
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
          scheduled_for?: string | null
          sender_identity_id?: string | null
          sent_at?: string | null
          smtp_account_id?: string | null
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
            foreignKeyName: "email_queue_sender_identity_id_fkey"
            columns: ["sender_identity_id"]
            isOneToOne: false
            referencedRelation: "sender_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_smtp_account_id_fkey"
            columns: ["smtp_account_id"]
            isOneToOne: false
            referencedRelation: "smtp_accounts"
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
      email_unsubscribes: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          email: string
          email_queue_id: string | null
          id: string
          ip_address: string | null
          reason: string | null
          unsubscribed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          email: string
          email_queue_id?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          unsubscribed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          email?: string
          email_queue_id?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          unsubscribed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integration_token_secrets: {
        Row: {
          token_hash: string
          token_id: string
        }
        Insert: {
          token_hash: string
          token_id: string
        }
        Update: {
          token_hash?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_token_secrets_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: true
            referencedRelation: "integration_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          client_id: string | null
          config: Json | null
          created_at: string
          id: string
          is_enabled: boolean
          provider: string
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          client_id?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          provider: string
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          client_id?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          provider?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      partnership_inquiries: {
        Row: {
          contact_number: string
          country: string
          created_at: string
          email: string
          id: string
          name: string
          partnership_type: string | null
        }
        Insert: {
          contact_number: string
          country: string
          created_at?: string
          email: string
          id?: string
          name: string
          partnership_type?: string | null
        }
        Update: {
          contact_number?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          partnership_type?: string | null
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
          dmarc_status: string
          dmarc_verified_at: string | null
          domain_status:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          email_provider: string | null
          from_email: string
          from_name: string
          id: string
          spf_status: string
          spf_verified_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          dkim_record?: string | null
          dmarc_status?: string
          dmarc_verified_at?: string | null
          domain_status?:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          email_provider?: string | null
          from_email: string
          from_name: string
          id?: string
          spf_status?: string
          spf_verified_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          dkim_record?: string | null
          dmarc_status?: string
          dmarc_verified_at?: string | null
          domain_status?:
            | Database["public"]["Enums"]["domain_status_type"]
            | null
          email_provider?: string | null
          from_email?: string
          from_name?: string
          id?: string
          spf_status?: string
          spf_verified_at?: string | null
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
      smtp_accounts: {
        Row: {
          client_id: string | null
          created_at: string
          daily_send_limit: number
          emails_sent_this_hour: number
          emails_sent_today: number
          hourly_send_limit: number
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          last_daily_reset: string
          last_hourly_reset: string
          provider: string
          sender_identity_id: string | null
          smtp_encryption: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          daily_send_limit?: number
          emails_sent_this_hour?: number
          emails_sent_today?: number
          hourly_send_limit?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          last_daily_reset?: string
          last_hourly_reset?: string
          provider?: string
          sender_identity_id?: string | null
          smtp_encryption?: string
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          daily_send_limit?: number
          emails_sent_this_hour?: number
          emails_sent_today?: number
          hourly_send_limit?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          last_daily_reset?: string
          last_hourly_reset?: string
          provider?: string
          sender_identity_id?: string | null
          smtp_encryption?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smtp_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smtp_accounts_sender_identity_id_fkey"
            columns: ["sender_identity_id"]
            isOneToOne: false
            referencedRelation: "sender_identities"
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
      webhook_logs: {
        Row: {
          created_at: string
          direction: string
          error_message: string | null
          event_type: string
          id: string
          integration_id: string | null
          payload: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction?: string
          error_message?: string | null
          event_type: string
          id?: string
          integration_id?: string | null
          payload?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          error_message?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          payload?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_integration_token: {
        Args: { _name: string; _token_hash: string }
        Returns: string
      }
      get_master_directory_categories: {
        Args: never
        Returns: {
          category: string
          latest_entry: string
          lead_count: number
          unique_emails: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pick_available_smtp: {
        Args: { _pool: string[]; _user_id: string }
        Returns: string
      }
      reserve_smtp_quota: { Args: { _smtp_id: string }; Returns: boolean }
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
        | "unsubscribed"
      domain_status_type: "unverified" | "verified"
      email_status_type: "pending" | "sent" | "failed"
      subscription_plan_type:
        | "monthly"
        | "yearly"
        | "starter_monthly"
        | "starter_yearly"
        | "business_monthly"
        | "business_yearly"
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
        "unsubscribed",
      ],
      domain_status_type: ["unverified", "verified"],
      email_status_type: ["pending", "sent", "failed"],
      subscription_plan_type: [
        "monthly",
        "yearly",
        "starter_monthly",
        "starter_yearly",
        "business_monthly",
        "business_yearly",
      ],
      subscription_status_type: ["active", "expired", "cancelled", "pending"],
      tier_type: ["starter", "growth"],
    },
  },
} as const
