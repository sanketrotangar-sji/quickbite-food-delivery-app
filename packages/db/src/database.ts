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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          order_id: string | null
          payload: Json
          restaurant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          payload?: Json
          restaurant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          payload?: Json
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["application_kind"]
          payload: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["application_kind"]
          payload?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["application_kind"]
          payload?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          order_id: string | null
          payload: Json
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          order_id?: string | null
          payload?: Json
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          payload?: Json
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          menu_item_id: string
          quantity: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          menu_item_id: string
          quantity: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          menu_item_id?: string
          quantity?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "cart_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_enrollments: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          id: string
          notified_at: string
          order_id: string | null
          redeemed_at: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          id?: string
          notified_at?: string
          order_id?: string | null
          redeemed_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notified_at?: string
          order_id?: string | null
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "crm_campaign_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number
          ends_at: string
          id: string
          launched_at: string | null
          restaurant_id: string | null
          starts_at: string
          status: string
          target_segment: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent: number
          ends_at: string
          id?: string
          launched_at?: string | null
          restaurant_id?: string | null
          starts_at?: string
          status?: string
          target_segment: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number
          ends_at?: string
          id?: string
          launched_at?: string | null
          restaurant_id?: string | null
          starts_at?: string
          status?: string
          target_segment?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "crm_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line: string
          area: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          lat: number | null
          lng: number | null
          nickname: string
          updated_at: string
        }
        Insert: {
          address_line: string
          area: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          nickname: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          area?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          nickname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences: {
        Row: {
          created_at: string
          customer_id: string
          rio_memory: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          rio_memory?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          rio_memory?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          content: string | null
          content_hash: string
          created_at: string
          embedding: string
          fts: unknown
          id: string
          metadata: Json
          source_id: string
          source_table: string
        }
        Insert: {
          content?: string | null
          content_hash: string
          created_at?: string
          embedding: string
          fts?: unknown
          id?: string
          metadata?: Json
          source_id: string
          source_table: string
        }
        Update: {
          content?: string | null
          content_hash?: string
          created_at?: string
          embedding?: string
          fts?: unknown
          id?: string
          metadata?: Json
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      home_highlights: {
        Row: {
          badge: string | null
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          kind: string
          priority: number
          restaurant_id: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          kind: string
          priority?: number
          restaurant_id?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          kind?: string
          priority?: number
          restaurant_id?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_highlights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_highlights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_config: {
        Row: {
          chat_model: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chat_model: string
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chat_model?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "llm_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          restaurant_id: string
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "manager_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "manager_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          canonical_key: string | null
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_bestseller: boolean
          is_synthetic: boolean
          is_veg: boolean
          name: string
          price: number
          restaurant_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          canonical_key?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_synthetic?: boolean
          is_veg?: boolean
          name: string
          price: number
          restaurant_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          canonical_key?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_synthetic?: boolean
          is_veg?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatch_log: {
        Row: {
          created_at: string
          event: string
          order_id: string
        }
        Insert: {
          created_at?: string
          event: string
          order_id: string
        }
        Update: {
          created_at?: string
          event?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dispatch_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          order_id: string | null
          payload: Json
          status: string
          template_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json
          status?: string
          template_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json
          status?: string
          template_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "notification_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_name: string
          line_total: number | null
          menu_item_id: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_name: string
          line_total?: number | null
          menu_item_id?: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          item_name?: string
          line_total?: number | null
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          created_at: string
          method: string
          order_id: string
          paid_at: string | null
          provider: string
          refund_note: string | null
          refunded_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          method?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          refund_note?: string | null
          refunded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          method?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          refund_note?: string | null
          refunded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          campaign_id?: string | null
          customer_id: string
          delivered_at?: string | null
          delivery_address: string
          delivery_address_id?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount_amount?: number
          drop_km?: number | null
          eta_minutes?: number | null
          id?: string
          notes?: string | null
          offer_percent?: number | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          pickup_km?: number | null
          placed_at?: string
          refund_note?: string | null
          refunded_at?: string | null
          restaurant_id: string
          rider_earning?: number | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tip_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          campaign_id?: string | null
          customer_id?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_address_id?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount_amount?: number
          drop_km?: number | null
          eta_minutes?: number | null
          id?: string
          notes?: string | null
          offer_percent?: number | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          pickup_km?: number | null
          placed_at?: string
          refund_note?: string | null
          refunded_at?: string | null
          restaurant_id?: string
          rider_earning?: number | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tip_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_online: boolean
          phone: string | null
          plate: string | null
          rio_memory: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          vehicle_label: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_online?: boolean
          phone?: string | null
          plate?: string | null
          rio_memory?: Json
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          vehicle_label?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_online?: boolean
          phone?: string | null
          plate?: string | null
          rio_memory?: Json
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          vehicle_label?: string | null
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          id: string
          last_seen_at: string
          metadata: Json
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          id?: string
          last_seen_at?: string
          metadata?: Json
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          id?: string
          last_seen_at?: string
          metadata?: Json
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          delivery_rating: number | null
          food_rating: number
          id: string
          order_id: string
          restaurant_id: string
          rider_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          delivery_rating?: number | null
          food_rating: number
          id?: string
          order_id: string
          restaurant_id: string
          rider_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          delivery_rating?: number | null
          food_rating?: number
          id?: string
          order_id?: string
          restaurant_id?: string
          rider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          restaurant_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          branch_name: string | null
          capacity_threshold: number
          closes_at: string | null
          cost_for_two: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          is_open: boolean
          is_pure_veg: boolean
          is_synthetic: boolean
          lat: number | null
          lng: number | null
          name: string
          offer_percent: number | null
          opens_at: string | null
          owner_id: string
          phone: string | null
          prep_minutes: number | null
          updated_at: string
        }
        Insert: {
          address: string
          branch_name?: string | null
          capacity_threshold?: number
          closes_at?: string | null
          cost_for_two?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          is_pure_veg?: boolean
          is_synthetic?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          offer_percent?: number | null
          opens_at?: string | null
          owner_id: string
          phone?: string | null
          prep_minutes?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          branch_name?: string | null
          capacity_threshold?: number
          closes_at?: string | null
          cost_for_two?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          is_pure_veg?: boolean
          is_synthetic?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          offer_percent?: number | null
          opens_at?: string | null
          owner_id?: string
          phone?: string | null
          prep_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "restaurants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_locations: {
        Row: {
          lat: number
          lng: number
          order_id: string | null
          rider_id: string
          updated_at: string
        }
        Insert: {
          lat: number
          lng: number
          order_id?: string | null
          rider_id: string
          updated_at?: string
        }
        Update: {
          lat?: number
          lng?: number
          order_id?: string | null
          rider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_locations_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rider_locations_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_profiles: {
        Row: {
          created_at: string
          is_online: boolean
          plate: string | null
          rider_id: string
          updated_at: string
          vehicle_label: string | null
        }
        Insert: {
          created_at?: string
          is_online?: boolean
          plate?: string | null
          rider_id: string
          updated_at?: string
          vehicle_label?: string | null
        }
        Update: {
          created_at?: string
          is_online?: boolean
          plate?: string | null
          rider_id?: string
          updated_at?: string
          vehicle_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_profiles_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rider_profiles_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rio_events: {
        Row: {
          actor_id: string
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string | null
          provider: string | null
          thread_id: string | null
          token_estimate: number | null
          tools: string[]
        }
        Insert: {
          actor_id: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          thread_id?: string | null
          token_estimate?: number | null
          tools?: string[]
        }
        Update: {
          actor_id?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          thread_id?: string | null
          token_estimate?: number | null
          tools?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "rio_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rio_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rio_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "rio_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      rio_messages: {
        Row: {
          cards: Json | null
          conflict: Json | null
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          cards?: Json | null
          conflict?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          cards?: Json | null
          conflict?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rio_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "rio_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      rio_threads: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rio_threads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rio_threads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          customer_id: string
          description: string
          id: string
          issue_type: string
          order_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          urgency: Database["public"]["Enums"]["ticket_urgency"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          description: string
          id?: string
          issue_type: string
          order_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          urgency?: Database["public"]["Enums"]["ticket_urgency"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          issue_type?: string
          order_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          urgency?: Database["public"]["Enums"]["ticket_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customer_segments"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_customer_segments: {
        Row: {
          customer_id: string | null
          delivered_60d: number | null
          delivered_count: number | null
          email: string | null
          full_name: string | null
          joined_at: string | null
          last_delivered_at: string | null
          phone: string | null
          segment: string | null
        }
        Relationships: []
      }
      restaurant_browse: {
        Row: {
          address: string | null
          branch_name: string | null
          closes_at: string | null
          cost_for_two: number | null
          created_at: string | null
          cuisine: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_open: boolean | null
          is_pure_veg: boolean | null
          lat: number | null
          lng: number | null
          name: string | null
          offer_percent: number | null
          opens_at: string | null
          prep_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_name?: string | null
          closes_at?: string | null
          cost_for_two?: number | null
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_open?: boolean | null
          is_pure_veg?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          offer_percent?: number | null
          opens_at?: string | null
          prep_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_name?: string | null
          closes_at?: string | null
          cost_for_two?: number | null
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_open?: boolean | null
          is_pure_veg?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          offer_percent?: number | null
          opens_at?: string | null
          prep_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      restaurant_rating_public: {
        Row: {
          food_rating: number | null
          restaurant_id: string | null
        }
        Insert: {
          food_rating?: number | null
          restaurant_id?: string | null
        }
        Update: {
          food_rating?: number | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_rating_summary: {
        Row: {
          avg_food: number | null
          rating_count: number | null
          restaurant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_browse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_manager_invite: { Args: { p_invite_id?: string }; Returns: number }
      activate_llm_config: {
        Args: { p_id: string }
        Returns: {
          chat_model: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "llm_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_force_order_status: {
        Args: {
          p_note: string
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_mark_order_refunded: {
        Args: { p_note: string; p_order_id: string }
        Returns: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_application: {
        Args: { p_application_id: string; p_approve: boolean; p_note?: string }
        Returns: {
          applicant_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["application_kind"]
          payload: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_ticket_status: {
        Args: {
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_ticket_id: string
        }
        Returns: {
          created_at: string
          customer_id: string
          description: string
          id: string
          issue_type: string
          order_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          urgency: Database["public"]["Enums"]["ticket_urgency"]
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_restaurant_ops: {
        Args: {
          p_address?: string
          p_capacity_threshold?: number
          p_lat?: number
          p_lng?: number
          p_offer_percent?: number
          p_prep_minutes?: number
          p_restaurant_id: string
        }
        Returns: {
          address: string
          branch_name: string | null
          capacity_threshold: number
          closes_at: string | null
          cost_for_two: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          is_open: boolean
          is_pure_veg: boolean
          is_synthetic: boolean
          lat: number | null
          lng: number | null
          name: string
          offer_percent: number | null
          opens_at: string | null
          owner_id: string
          phone: string | null
          prep_minutes: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      browse_restaurants: {
        Args: {
          p_cuisine?: string
          p_cursor?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_min_rating?: number
          p_offers_only?: boolean
          p_open_only?: boolean
          p_query?: string
          p_sort?: string
          p_veg_only?: boolean
        }
        Returns: Json
      }
      claim_delivery: {
        Args: { p_order_id: string }
        Returns: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_campaign_stats: {
        Args: { p_campaign_id?: string }
        Returns: {
          campaign_id: string
          discount_percent: number
          ends_at: string
          enrolled: number
          expired_unredeemed: number
          redeemed: number
          starts_at: string
          status: string
          target_segment: string
          title: string
        }[]
      }
      crm_create_campaign: {
        Args: {
          p_description: string
          p_discount_percent: number
          p_ends_at: string
          p_restaurant_id?: string
          p_starts_at: string
          p_target_segment: string
          p_title: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number
          ends_at: string
          id: string
          launched_at: string | null
          restaurant_id: string | null
          starts_at: string
          status: string
          target_segment: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_end_campaign: {
        Args: { p_campaign_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number
          ends_at: string
          id: string
          launched_at: string | null
          restaurant_id: string | null
          starts_at: string
          status: string
          target_segment: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_launch_campaign: { Args: { p_campaign_id: string }; Returns: Json }
      crm_list_segment_members: {
        Args: { p_limit?: number; p_segment: string }
        Returns: {
          customer_id: string | null
          delivered_60d: number | null
          delivered_count: number | null
          email: string | null
          full_name: string | null
          joined_at: string | null
          last_delivered_at: string | null
          phone: string | null
          segment: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_customer_segments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crm_segment_counts: {
        Args: never
        Returns: {
          member_count: number
          segment: string
        }[]
      }
      enqueue_notification_job: {
        Args: {
          p_channel: string
          p_dedupe_key: string
          p_order_id: string
          p_payload: Json
          p_template_key: string
          p_user_id: string
        }
        Returns: boolean
      }
      home_feed: { Args: { p_lat?: number; p_lng?: number }; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      list_my_restaurants: {
        Args: never
        Returns: {
          address: string
          branch_name: string | null
          capacity_threshold: number
          closes_at: string | null
          cost_for_two: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          is_open: boolean
          is_pure_veg: boolean
          is_synthetic: boolean
          lat: number | null
          lng: number | null
          name: string
          offer_percent: number | null
          opens_at: string | null
          owner_id: string
          phone: string | null
          prep_minutes: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_rider_delivery_pool: {
        Args: never
        Returns: {
          area_hint: string
          bonus_amount: number
          cuisine: string
          drop_km: number
          eta_minutes: number
          id: string
          image_url: string
          item_count: number
          items_summary: string
          pickup_km: number
          placed_at: string
          restaurant_address: string
          restaurant_id: string
          restaurant_lat: number
          restaurant_lng: number
          restaurant_name: string
          rider_earning: number
          status: Database["public"]["Enums"]["order_status"]
          tip_amount: number
          total_amount: number
        }[]
      }
      mark_notification_job: {
        Args: { p_dedupe_key: string; p_error?: string; p_status: string }
        Returns: undefined
      }
      match_embeddings: {
        Args: {
          filter_source?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          meta: Json
          preview: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      match_embeddings_hybrid: {
        Args: {
          filter_category?: string
          filter_is_veg?: boolean
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          content: string
          score: number
          source_id: string
          source_table: string
          vector_similarity: number
        }[]
      }
      order_tracking: { Args: { p_order_id: string }; Returns: Json }
      owner_create_branch: {
        Args: {
          p_address: string
          p_branch_name?: string
          p_cuisine?: string
          p_description?: string
          p_name: string
          p_phone?: string
        }
        Returns: {
          address: string
          branch_name: string | null
          capacity_threshold: number
          closes_at: string | null
          cost_for_two: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          is_open: boolean
          is_pure_veg: boolean
          is_synthetic: boolean
          lat: number | null
          lng: number | null
          name: string
          offer_percent: number | null
          opens_at: string | null
          owner_id: string
          phone: string | null
          prep_minutes: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_invite_manager: {
        Args: { p_email: string; p_restaurant_id: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          restaurant_id: string
          status: Database["public"]["Enums"]["invite_status"]
        }
        SetofOptions: {
          from: "*"
          to: "manager_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_revoke_manager: {
        Args: { p_restaurant_id: string; p_user_id: string }
        Returns: undefined
      }
      place_order: {
        Args: {
          p_delivery_address?: string
          p_delivery_address_id?: string
          p_delivery_lat?: number
          p_delivery_lng?: number
          p_notes?: string
        }
        Returns: string
      }
      register_push_device: {
        Args: { p_metadata?: Json; p_platform: string; p_token: string }
        Returns: {
          created_at: string
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          id: string
          last_seen_at: string
          metadata: Json
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_device_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restaurant_detail: {
        Args: { p_id: string; p_lat?: number; p_lng?: number }
        Returns: Json
      }
      restaurant_set_order_status: {
        Args: {
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rider_set_duty: { Args: { p_is_online: boolean }; Returns: boolean }
      rider_set_order_status: {
        Args: {
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          bonus_amount: number
          campaign_id: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_address_id: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount_amount: number
          drop_km: number | null
          eta_minutes: number | null
          id: string
          notes: string | null
          offer_percent: number | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_km: number | null
          placed_at: string
          refund_note: string | null
          refunded_at: string | null
          restaurant_id: string
          rider_earning: number | null
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rider_update_location: {
        Args: { p_lat: number; p_lng: number; p_order_id: string }
        Returns: {
          lat: number
          lng: number
          order_id: string | null
          rider_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rider_locations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rio_snapshot: { Args: { p_delivery_address_id?: string }; Returns: Json }
      rio_update_memory: { Args: { p_patch: Json }; Returns: Json }
      run_kitchen_load_alerts: { Args: never; Returns: Json }
      run_order_accept_timeout: { Args: never; Returns: Json }
      set_default_customer_address: {
        Args: { p_address_id: string }
        Returns: {
          address_line: string
          area: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          lat: number | null
          lng: number | null
          nickname: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_addresses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      standard_delivery_fee: { Args: never; Returns: number }
      submit_application: {
        Args: {
          p_kind: Database["public"]["Enums"]["application_kind"]
          p_payload?: Json
        }
        Returns: {
          applicant_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["application_kind"]
          payload: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "customer"
        | "restaurant_manager"
        | "rider"
        | "restaurant_owner"
        | "admin"
      application_kind: "rider" | "restaurant_owner"
      application_status: "pending" | "approved" | "rejected"
      invite_status: "pending" | "accepted" | "revoked"
      member_status: "active" | "revoked"
      order_status:
        | "placed"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      ticket_status: "open" | "in_progress" | "resolved"
      ticket_urgency: "low" | "medium" | "high"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "customer",
        "restaurant_manager",
        "rider",
        "restaurant_owner",
        "admin",
      ],
      application_kind: ["rider", "restaurant_owner"],
      application_status: ["pending", "approved", "rejected"],
      invite_status: ["pending", "accepted", "revoked"],
      member_status: ["active", "revoked"],
      order_status: [
        "placed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      ticket_status: ["open", "in_progress", "resolved"],
      ticket_urgency: ["low", "medium", "high"],
    },
  },
} as const
