export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      assets: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          name: string
          org_id: string
          spec: Json
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          name: string
          org_id: string
          spec?: Json
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          name?: string
          org_id?: string
          spec?: Json
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          at: string
          event: Json
          id: number
          org_id: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          event: Json
          id?: never
          org_id: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          event?: Json
          id?: never
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_guides: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          org_id: string
          source_kind: Database["public"]["Enums"]["guide_source_kind"]
          source_url: string | null
          status: Database["public"]["Enums"]["guide_status"]
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          org_id: string
          source_kind: Database["public"]["Enums"]["guide_source_kind"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["guide_status"]
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          org_id?: string
          source_kind?: Database["public"]["Enums"]["guide_source_kind"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["guide_status"]
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_guides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          name: string
          org_id: string
          starts_on: string | null
          status: Database["public"]["Enums"]["campaign_status"]
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          org_id: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          org_id?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anchor: Json | null
          author_id: string
          body: string
          created_at: string
          id: string
          org_id: string
          parent_id: string | null
          version_id: string
        }
        Insert: {
          anchor?: Json | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          org_id: string
          parent_id?: string | null
          version_id: string
        }
        Update: {
          anchor?: Json | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          org_id?: string
          parent_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          campaign_id: string
          channel: string
          created_at: string
          current_version_id: string | null
          format: Database["public"]["Enums"]["content_format"]
          id: string
          org_id: string
          owner_id: string
          risk_score: number | null
          route_to: string | null
          state: Database["public"]["Enums"]["content_state"]
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel: string
          created_at?: string
          current_version_id?: string | null
          format?: Database["public"]["Enums"]["content_format"]
          id?: string
          org_id: string
          owner_id: string
          risk_score?: number | null
          route_to?: string | null
          state?: Database["public"]["Enums"]["content_state"]
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          created_at?: string
          current_version_id?: string | null
          format?: Database["public"]["Enums"]["content_format"]
          id?: string
          org_id?: string
          owner_id?: string
          risk_score?: number | null
          route_to?: string | null
          state?: Database["public"]["Enums"]["content_state"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contents_org_id_campaign_id_fkey"
            columns: ["org_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "contents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          action: Database["public"]["Enums"]["decision_action"]
          actor_id: string | null
          created_at: string
          finding_id: string | null
          id: string
          org_id: string
          reason: string | null
          version_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["decision_action"]
          actor_id?: string | null
          created_at?: string
          finding_id?: string | null
          id?: string
          org_id: string
          reason?: string | null
          version_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["decision_action"]
          actor_id?: string | null
          created_at?: string
          finding_id?: string | null
          id?: string
          org_id?: string
          reason?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      example_suggestions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          examples: Json
          id: string
          org_id: string
          rule_id: string
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          examples: Json
          id?: string
          org_id: string
          rule_id: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          examples?: Json
          id?: string
          org_id?: string
          rule_id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "example_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "example_suggestions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rule_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "example_suggestions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rule_cards_public"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          embedding: string | null
          embedding_source_hash: string | null
          id: string
          kind: Database["public"]["Enums"]["fact_kind"]
          never_send: boolean
          org_id: string
          required_disclaimer: string | null
          statement: string
          updated_at: string
          valid_until: string | null
          value: Json
        }
        Insert: {
          campaign_id?: string | null
          code: string
          created_at?: string
          embedding?: string | null
          embedding_source_hash?: string | null
          id?: string
          kind: Database["public"]["Enums"]["fact_kind"]
          never_send?: boolean
          org_id: string
          required_disclaimer?: string | null
          statement: string
          updated_at?: string
          valid_until?: string | null
          value?: Json
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          embedding?: string | null
          embedding_source_hash?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["fact_kind"]
          never_send?: boolean
          org_id?: string
          required_disclaimer?: string | null
          statement?: string
          updated_at?: string
          valid_until?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "facts_org_id_campaign_id_fkey"
            columns: ["org_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "facts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          confidence: number
          created_at: string
          dimension: Database["public"]["Enums"]["dimension"]
          dismiss_note: string | null
          dismiss_reason: Database["public"]["Enums"]["dismiss_reason"] | null
          explanation: string
          fact_id: string | null
          id: string
          model_version: string | null
          org_id: string
          prompt_version: string | null
          quote: string
          resolved_at: string | null
          resolved_by: string | null
          rewrite: string | null
          rule_id: string | null
          run_id: string
          severity: Database["public"]["Enums"]["severity"]
          source: Database["public"]["Enums"]["finding_source"]
          span: Json
          status: Database["public"]["Enums"]["finding_status"]
          version_id: string
          wcag_ref: string | null
        }
        Insert: {
          confidence: number
          created_at?: string
          dimension: Database["public"]["Enums"]["dimension"]
          dismiss_note?: string | null
          dismiss_reason?: Database["public"]["Enums"]["dismiss_reason"] | null
          explanation: string
          fact_id?: string | null
          id?: string
          model_version?: string | null
          org_id: string
          prompt_version?: string | null
          quote: string
          resolved_at?: string | null
          resolved_by?: string | null
          rewrite?: string | null
          rule_id?: string | null
          run_id: string
          severity: Database["public"]["Enums"]["severity"]
          source: Database["public"]["Enums"]["finding_source"]
          span: Json
          status?: Database["public"]["Enums"]["finding_status"]
          version_id: string
          wcag_ref?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          dimension?: Database["public"]["Enums"]["dimension"]
          dismiss_note?: string | null
          dismiss_reason?: Database["public"]["Enums"]["dismiss_reason"] | null
          explanation?: string
          fact_id?: string | null
          id?: string
          model_version?: string | null
          org_id?: string
          prompt_version?: string | null
          quote?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rewrite?: string | null
          rule_id?: string | null
          run_id?: string
          severity?: Database["public"]["Enums"]["severity"]
          source?: Database["public"]["Enums"]["finding_source"]
          span?: Json
          status?: Database["public"]["Enums"]["finding_status"]
          version_id?: string
          wcag_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rule_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rule_cards_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "review_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: {
          banned: boolean
          case_sensitive: boolean
          code: string
          id: string
          note: string | null
          org_id: string
          preferred: string
          variants: string[]
        }
        Insert: {
          banned?: boolean
          case_sensitive?: boolean
          code: string
          id?: string
          note?: string | null
          org_id: string
          preferred: string
          variants?: string[]
        }
        Update: {
          banned?: boolean
          case_sensitive?: boolean
          code?: string
          id?: string
          note?: string | null
          org_id?: string
          preferred?: string
          variants?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "glossary_terms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          specialist_kind: Database["public"]["Enums"]["specialist_kind"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          specialist_kind?:
            | Database["public"]["Enums"]["specialist_kind"]
            | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          specialist_kind?:
            | Database["public"]["Enums"]["specialist_kind"]
            | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      review_runs: {
        Row: {
          created_at: string
          degraded: boolean
          error_code: string | null
          finished_at: string | null
          id: string
          model_version: string | null
          org_id: string
          pages: Json
          prompt_version: string | null
          provider: string | null
          retrieved: Json
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          timings: Json
          version_id: string
        }
        Insert: {
          created_at?: string
          degraded?: boolean
          error_code?: string | null
          finished_at?: string | null
          id?: string
          model_version?: string | null
          org_id: string
          pages?: Json
          prompt_version?: string | null
          provider?: string | null
          retrieved?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          timings?: Json
          version_id: string
        }
        Update: {
          created_at?: string
          degraded?: boolean
          error_code?: string | null
          finished_at?: string | null
          id?: string
          model_version?: string | null
          org_id?: string
          pages?: Json
          prompt_version?: string | null
          provider?: string | null
          retrieved?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          timings?: Json
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_cards: {
        Row: {
          body: string
          code: string
          created_at: string
          dimension: Database["public"]["Enums"]["dimension"]
          embedding: string | null
          embedding_source_hash: string | null
          examples: Json
          guide_id: string | null
          id: string
          never_send: boolean
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          source_page: number | null
          status: Database["public"]["Enums"]["rule_status"]
          summary: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          code: string
          created_at?: string
          dimension: Database["public"]["Enums"]["dimension"]
          embedding?: string | null
          embedding_source_hash?: string | null
          examples?: Json
          guide_id?: string | null
          id?: string
          never_send?: boolean
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          source_page?: number | null
          status?: Database["public"]["Enums"]["rule_status"]
          summary: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          code?: string
          created_at?: string
          dimension?: Database["public"]["Enums"]["dimension"]
          embedding?: string | null
          embedding_source_hash?: string | null
          examples?: Json
          guide_id?: string | null
          id?: string
          never_send?: boolean
          org_id?: string
          severity?: Database["public"]["Enums"]["severity"]
          source_page?: number | null
          status?: Database["public"]["Enums"]["rule_status"]
          summary?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_cards_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "brand_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      versions: {
        Row: {
          body: string | null
          content_id: string
          created_at: string
          created_by: string | null
          format: Database["public"]["Enums"]["content_format"]
          id: string
          intent: Json
          n: number
          storage_path: string | null
        }
        Insert: {
          body?: string | null
          content_id: string
          created_at?: string
          created_by?: string | null
          format: Database["public"]["Enums"]["content_format"]
          id?: string
          intent?: Json
          n: number
          storage_path?: string | null
        }
        Update: {
          body?: string | null
          content_id?: string
          created_at?: string
          created_by?: string | null
          format?: Database["public"]["Enums"]["content_format"]
          id?: string
          intent?: Json
          n?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rule_cards_public: {
        Row: {
          code: string | null
          created_at: string | null
          dimension: Database["public"]["Enums"]["dimension"] | null
          id: string | null
          org_id: string | null
          severity: Database["public"]["Enums"]["severity"] | null
          status: Database["public"]["Enums"]["rule_status"] | null
          summary: string | null
          title: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          dimension?: Database["public"]["Enums"]["dimension"] | null
          id?: string | null
          org_id?: string | null
          severity?: Database["public"]["Enums"]["severity"] | null
          status?: Database["public"]["Enums"]["rule_status"] | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          dimension?: Database["public"]["Enums"]["dimension"] | null
          id?: string | null
          org_id?: string | null
          severity?: Database["public"]["Enums"]["severity"] | null
          status?: Database["public"]["Enums"]["rule_status"] | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_rule_card: {
        Args: { p_id: string }
        Returns: {
          body: string
          code: string
          created_at: string
          dimension: Database["public"]["Enums"]["dimension"]
          embedding: string | null
          embedding_source_hash: string | null
          examples: Json
          guide_id: string | null
          id: string
          never_send: boolean
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          source_page: number | null
          status: Database["public"]["Enums"]["rule_status"]
          summary: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "rule_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_act_on_version: { Args: { p_version_id: string }; Returns: boolean }
      can_edit_content: { Args: { p_content_id: string }; Returns: boolean }
      can_read_content: { Args: { p_content_id: string }; Returns: boolean }
      can_read_version: { Args: { p_version_id: string }; Returns: boolean }
      decide_example_suggestion: {
        Args: { p_id: string; p_keep: number[] }
        Returns: {
          body: string
          code: string
          created_at: string
          dimension: Database["public"]["Enums"]["dimension"]
          embedding: string | null
          embedding_source_hash: string | null
          examples: Json
          guide_id: string | null
          id: string
          never_send: boolean
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          source_page: number | null
          status: Database["public"]["Enums"]["rule_status"]
          summary: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "rule_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_review: { Args: { p_version_id: string }; Returns: string }
      enqueue_vault_job: {
        Args: { p_job: string; p_org: string; p_payload?: Json }
        Returns: number
      }
      flag_unclear_rules: {
        Args: { p_org: string }
        Returns: {
          code: string
          gcs: number
          rule_id: string
        }[]
      }
      has_org_role: {
        Args: {
          org: string
          roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      insights_summary: {
        Args: { p_org: string; p_since?: string }
        Returns: Json
      }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_org_staff: { Args: { org: string }; Returns: boolean }
      match_vault: {
        Args: {
          p_campaign: string
          p_dimensions?: Database["public"]["Enums"]["dimension"][]
          p_embedding: string
          p_k: number
          p_org: string
        }
        Returns: {
          code: string
          content: string
          dimension: Database["public"]["Enums"]["dimension"]
          id: string
          kind: string
          severity: Database["public"]["Enums"]["severity"]
          similarity: number
          title: string
          value: Json
        }[]
      }
      revise_rule_card: {
        Args: {
          p_body: string
          p_dimension: Database["public"]["Enums"]["dimension"]
          p_examples: Json
          p_id: string
          p_severity: Database["public"]["Enums"]["severity"]
          p_summary: string
          p_title: string
        }
        Returns: {
          body: string
          code: string
          created_at: string
          dimension: Database["public"]["Enums"]["dimension"]
          embedding: string | null
          embedding_source_hash: string | null
          examples: Json
          guide_id: string | null
          id: string
          never_send: boolean
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          source_page: number | null
          status: Database["public"]["Enums"]["rule_status"]
          summary: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "rule_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rule_gcs: {
        Args: { p_org: string; p_since?: string }
        Returns: {
          card_status: Database["public"]["Enums"]["rule_status"]
          code: string
          dimension: Database["public"]["Enums"]["dimension"]
          dismissal_rate: number
          gcs: number
          low_confidence_rate: number
          n: number
          override_rate: number
          rule_id: string
          status: string
          title: string
          version: number
        }[]
      }
      storage_content_in_org: { Args: { p_name: string }; Returns: boolean }
      storage_path_uuid: {
        Args: { p_name: string; p_segment: number }
        Returns: string
      }
      transition_content: {
        Args: {
          p_content_id: string
          p_reason?: string
          p_route_to?: string
          p_to: Database["public"]["Enums"]["content_state"]
        }
        Returns: {
          campaign_id: string
          channel: string
          created_at: string
          current_version_id: string | null
          format: Database["public"]["Enums"]["content_format"]
          id: string
          org_id: string
          owner_id: string
          risk_score: number | null
          route_to: string | null
          state: Database["public"]["Enums"]["content_state"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_content_system: {
        Args: {
          p_content_id: string
          p_reason?: string
          p_risk_score?: number
          p_route_to?: string
          p_to: Database["public"]["Enums"]["content_state"]
        }
        Returns: {
          campaign_id: string
          channel: string
          created_at: string
          current_version_id: string | null
          format: Database["public"]["Enums"]["content_format"]
          id: string
          org_id: string
          owner_id: string
          risk_score: number | null
          route_to: string | null
          state: Database["public"]["Enums"]["content_state"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      version_org: { Args: { p_version_id: string }; Returns: string }
    }
    Enums: {
      asset_kind: "logo" | "palette" | "font" | "reference_image"
      campaign_status: "planned" | "active" | "ended"
      content_format: "text" | "markdown" | "html" | "docx" | "image" | "pdf"
      content_state:
        | "draft"
        | "ai_check"
        | "needs_revision"
        | "in_review"
        | "changes_requested"
        | "specialist_review"
        | "approved"
        | "publish_ready"
        | "archived"
      decision_action:
        | "approve"
        | "request_changes"
        | "sign_off"
        | "override"
        | "mark_ready"
        | "archive"
      dimension: "tone" | "terms" | "facts" | "claims" | "visual" | "access"
      dismiss_reason: "approved_exception" | "doesnt_apply" | "ai_wrong"
      fact_kind:
        | "product"
        | "event"
        | "fee"
        | "rate"
        | "date"
        | "venue"
        | "other"
      finding_source: "deterministic" | "llm"
      finding_status:
        | "open"
        | "accepted"
        | "edited"
        | "dismissed"
        | "routed"
        | "superseded"
      guide_source_kind: "pdf" | "docx" | "url"
      guide_status: "uploaded" | "parsing" | "drafted" | "failed"
      member_role:
        | "agency_creator"
        | "creator"
        | "manager"
        | "specialist"
        | "brand_admin"
      rule_status: "draft" | "approved" | "archived"
      run_status: "queued" | "running" | "done" | "failed"
      severity: "blocker" | "warning" | "suggestion"
      specialist_kind: "legal" | "a11y"
      suggestion_status: "pending" | "approved" | "rejected"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_kind: ["logo", "palette", "font", "reference_image"],
      campaign_status: ["planned", "active", "ended"],
      content_format: ["text", "markdown", "html", "docx", "image", "pdf"],
      content_state: [
        "draft",
        "ai_check",
        "needs_revision",
        "in_review",
        "changes_requested",
        "specialist_review",
        "approved",
        "publish_ready",
        "archived",
      ],
      decision_action: [
        "approve",
        "request_changes",
        "sign_off",
        "override",
        "mark_ready",
        "archive",
      ],
      dimension: ["tone", "terms", "facts", "claims", "visual", "access"],
      dismiss_reason: ["approved_exception", "doesnt_apply", "ai_wrong"],
      fact_kind: ["product", "event", "fee", "rate", "date", "venue", "other"],
      finding_source: ["deterministic", "llm"],
      finding_status: [
        "open",
        "accepted",
        "edited",
        "dismissed",
        "routed",
        "superseded",
      ],
      guide_source_kind: ["pdf", "docx", "url"],
      guide_status: ["uploaded", "parsing", "drafted", "failed"],
      member_role: [
        "agency_creator",
        "creator",
        "manager",
        "specialist",
        "brand_admin",
      ],
      rule_status: ["draft", "approved", "archived"],
      run_status: ["queued", "running", "done", "failed"],
      severity: ["blocker", "warning", "suggestion"],
      specialist_kind: ["legal", "a11y"],
      suggestion_status: ["pending", "approved", "rejected"],
    },
  },
} as const

