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
      activities: {
        Row: {
          contact_id: string | null
          id: string
          logged_at: string
          next_action: string | null
          next_action_at: string | null
          note: string | null
          opportunity_id: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
          voice_note_url: string | null
        }
        Insert: {
          contact_id?: string | null
          id?: string
          logged_at?: string
          next_action?: string | null
          next_action_at?: string | null
          note?: string | null
          opportunity_id: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
          voice_note_url?: string | null
        }
        Update: {
          contact_id?: string | null
          id?: string
          logged_at?: string
          next_action?: string | null
          next_action_at?: string | null
          note?: string | null
          opportunity_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_quotes: {
        Row: {
          carried_us: boolean
          created_at: string
          gc_company_id: string
          gc_won_award: boolean
          id: string
          notes: string | null
          opportunity_id: string
          quoted_amount: number | null
        }
        Insert: {
          carried_us?: boolean
          created_at?: string
          gc_company_id: string
          gc_won_award?: boolean
          id?: string
          notes?: string | null
          opportunity_id: string
          quoted_amount?: number | null
        }
        Update: {
          carried_us?: boolean
          created_at?: string
          gc_company_id?: string
          gc_won_award?: boolean
          id?: string
          notes?: string | null
          opportunity_id?: string
          quoted_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_quotes_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_quotes_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bid_quotes_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_company_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_quotes_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_concentration"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bid_quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          addenda_acknowledged: boolean
          bid_due_at: string | null
          bid_tab_position: number | null
          bond_amount: number | null
          bond_arranged: boolean
          bond_required: boolean
          estimate_file_url: string | null
          expected_award_date: string | null
          gc_bid_date: string | null
          gc_carried_us: boolean | null
          gc_company_id: string | null
          go_no_go: boolean
          id: string
          invited: boolean
          low_bid_amount: number | null
          opportunity_id: string
          plans_link: string | null
          prebid_walk_at: string | null
          prebid_walk_completed: boolean
          prebid_walk_mandatory: boolean
          quote_delivered: boolean
          sub_po_received: boolean
        }
        Insert: {
          addenda_acknowledged?: boolean
          bid_due_at?: string | null
          bid_tab_position?: number | null
          bond_amount?: number | null
          bond_arranged?: boolean
          bond_required?: boolean
          estimate_file_url?: string | null
          expected_award_date?: string | null
          gc_bid_date?: string | null
          gc_carried_us?: boolean | null
          gc_company_id?: string | null
          go_no_go?: boolean
          id?: string
          invited?: boolean
          low_bid_amount?: number | null
          opportunity_id: string
          plans_link?: string | null
          prebid_walk_at?: string | null
          prebid_walk_completed?: boolean
          prebid_walk_mandatory?: boolean
          quote_delivered?: boolean
          sub_po_received?: boolean
        }
        Update: {
          addenda_acknowledged?: boolean
          bid_due_at?: string | null
          bid_tab_position?: number | null
          bond_amount?: number | null
          bond_arranged?: boolean
          bond_required?: boolean
          estimate_file_url?: string | null
          expected_award_date?: string | null
          gc_bid_date?: string | null
          gc_carried_us?: boolean | null
          gc_company_id?: string | null
          go_no_go?: boolean
          id?: string
          invited?: boolean
          low_bid_amount?: number | null
          opportunity_id?: string
          plans_link?: string | null
          prebid_walk_at?: string | null
          prebid_walk_completed?: boolean
          prebid_walk_mandatory?: boolean
          quote_delivered?: boolean
          sub_po_received?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bids_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bids_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_company_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_concentration"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bids_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          address_line1: string | null
          archived_at: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          on_bid_list: boolean
          phone: string | null
          planroom_url: string | null
          region: string
          state: string | null
          status: string | null
          type: Database["public"]["Enums"]["company_type"]
          website: string | null
          zip: string | null
        }
        Insert: {
          address: string
          address_line1?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          on_bid_list?: boolean
          phone?: string | null
          planroom_url?: string | null
          region: string
          state?: string | null
          status?: string | null
          type: Database["public"]["Enums"]["company_type"]
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string
          address_line1?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          on_bid_list?: boolean
          phone?: string | null
          planroom_url?: string | null
          region?: string
          state?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["company_type"]
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      company_notes: {
        Row: {
          author_id: string
          body: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_concentration"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          author_id: string
          body: string
          contact_id: string
          created_at: string
          external_id: string | null
          id: string
          source: string
        }
        Insert: {
          author_id: string
          body: string
          contact_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
        }
        Update: {
          author_id?: string
          body?: string
          contact_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_decision_maker: boolean
          is_favorite: boolean
          last_contacted_at: string | null
          linkedin_url: string | null
          name: string
          next_action: string | null
          next_action_date: string | null
          phone: string
          role: Database["public"]["Enums"]["contact_role"]
          state: string | null
          title: string | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean
          is_favorite?: boolean
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          phone: string
          role: Database["public"]["Enums"]["contact_role"]
          state?: string | null
          title?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean
          is_favorite?: boolean
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          phone?: string
          role?: Database["public"]["Enums"]["contact_role"]
          state?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_concentration"
            referencedColumns: ["company_id"]
          },
        ]
      }
      facility_details: {
        Row: {
          budget_cycle: string | null
          contact_made: boolean
          decision_maker_id: string | null
          id: string
          opportunity_id: string
          po_or_capital_approval: boolean
          proposal_delivered: boolean
          square_footage: number | null
          survey_completed: boolean
          warranty_term: string | null
        }
        Insert: {
          budget_cycle?: string | null
          contact_made?: boolean
          decision_maker_id?: string | null
          id?: string
          opportunity_id: string
          po_or_capital_approval?: boolean
          proposal_delivered?: boolean
          square_footage?: number | null
          survey_completed?: boolean
          warranty_term?: string | null
        }
        Update: {
          budget_cycle?: string | null
          contact_made?: boolean
          decision_maker_id?: string | null
          id?: string
          opportunity_id?: string
          po_or_capital_approval?: boolean
          proposal_delivered?: boolean
          square_footage?: number | null
          survey_completed?: boolean
          warranty_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_details_decision_maker_id_fkey"
            columns: ["decision_maker_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      federal_details: {
        Row: {
          agency_advantage: number | null
          award_amount: number | null
          bid_package_url: string | null
          bond_amount: number | null
          bond_arranged: boolean
          bond_required: boolean
          capability_statement: string | null
          co_email: string | null
          co_phone: string | null
          contracting_officer: string | null
          created_at: string
          department: string | null
          estimate_mobilization: number | null
          estimate_sqft_rate: number | null
          estimate_total: number | null
          extraction_json: Json | null
          extraction_status: string
          geography_fit: number | null
          id: string
          magnitude: string | null
          magnitude_fit: number | null
          naics_code: string
          office: string | null
          opportunity_id: string
          past_performance: string | null
          pricing_intel: Json | null
          response_deadline: string | null
          sam_notice_id: string | null
          sam_url: string | null
          scope_fit: number | null
          score_reasons: Json | null
          score_recommendation: string | null
          scoring_status: string
          set_aside_advantage: number | null
          set_aside_type: string | null
          site_visit_completed: boolean
          site_visit_date: string | null
          site_visit_mandatory: boolean
          solicitation_number: string | null
          square_footage: number | null
          submission_method: string | null
          submitted_at: string | null
          surface_prep: string | null
          system_spec: string | null
          technical_approach: string | null
          wage_determination: string | null
        }
        Insert: {
          agency_advantage?: number | null
          award_amount?: number | null
          bid_package_url?: string | null
          bond_amount?: number | null
          bond_arranged?: boolean
          bond_required?: boolean
          capability_statement?: string | null
          co_email?: string | null
          co_phone?: string | null
          contracting_officer?: string | null
          created_at?: string
          department?: string | null
          estimate_mobilization?: number | null
          estimate_sqft_rate?: number | null
          estimate_total?: number | null
          extraction_json?: Json | null
          extraction_status?: string
          geography_fit?: number | null
          id?: string
          magnitude?: string | null
          magnitude_fit?: number | null
          naics_code?: string
          office?: string | null
          opportunity_id: string
          past_performance?: string | null
          pricing_intel?: Json | null
          response_deadline?: string | null
          sam_notice_id?: string | null
          sam_url?: string | null
          scope_fit?: number | null
          score_reasons?: Json | null
          score_recommendation?: string | null
          scoring_status?: string
          set_aside_advantage?: number | null
          set_aside_type?: string | null
          site_visit_completed?: boolean
          site_visit_date?: string | null
          site_visit_mandatory?: boolean
          solicitation_number?: string | null
          square_footage?: number | null
          submission_method?: string | null
          submitted_at?: string | null
          surface_prep?: string | null
          system_spec?: string | null
          technical_approach?: string | null
          wage_determination?: string | null
        }
        Update: {
          agency_advantage?: number | null
          award_amount?: number | null
          bid_package_url?: string | null
          bond_amount?: number | null
          bond_arranged?: boolean
          bond_required?: boolean
          capability_statement?: string | null
          co_email?: string | null
          co_phone?: string | null
          contracting_officer?: string | null
          created_at?: string
          department?: string | null
          estimate_mobilization?: number | null
          estimate_sqft_rate?: number | null
          estimate_total?: number | null
          extraction_json?: Json | null
          extraction_status?: string
          geography_fit?: number | null
          id?: string
          magnitude?: string | null
          magnitude_fit?: number | null
          naics_code?: string
          office?: string | null
          opportunity_id?: string
          past_performance?: string | null
          pricing_intel?: Json | null
          response_deadline?: string | null
          sam_notice_id?: string | null
          sam_url?: string | null
          scope_fit?: number | null
          score_reasons?: Json | null
          score_recommendation?: string | null
          scoring_status?: string
          set_aside_advantage?: number | null
          set_aside_type?: string | null
          site_visit_completed?: boolean
          site_visit_date?: string | null
          site_visit_mandatory?: boolean
          solicitation_number?: string | null
          square_footage?: number | null
          submission_method?: string | null
          submitted_at?: string | null
          surface_prep?: string | null
          system_spec?: string | null
          technical_approach?: string | null
          wage_determination?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "federal_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federal_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federal_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          owner_id: string | null
          period: string
          period_month: number | null
          period_quarter: number | null
          period_year: number
          pipeline: string | null
          target_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          owner_id?: string | null
          period: string
          period_month?: number | null
          period_quarter?: number | null
          period_year: number
          pipeline?: string | null
          target_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          owner_id?: string | null
          period?: string
          period_month?: number | null
          period_quarter?: number | null
          period_year?: number
          pipeline?: string | null
          target_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          amount: number | null
          company_id: string
          competitor: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          expected_close_date: string | null
          final_value: number | null
          gross_profit_pct: number | null
          id: string
          job_site_address: string
          job_site_lat: number | null
          job_site_lng: number | null
          lost_reason: string | null
          name: string
          next_step: string | null
          next_step_date: string | null
          owner_id: string
          pipeline: Database["public"]["Enums"]["pipeline_type"]
          prevailing_wage: boolean | null
          priority: string | null
          project_tag: string | null
          revisit_date: string | null
          stage: string
          stage_entered_at: string | null
          status: Database["public"]["Enums"]["opp_status"]
          updated_at: string | null
          win_probability: number | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          competitor?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          expected_close_date?: string | null
          final_value?: number | null
          gross_profit_pct?: number | null
          id?: string
          job_site_address: string
          job_site_lat?: number | null
          job_site_lng?: number | null
          lost_reason?: string | null
          name: string
          next_step?: string | null
          next_step_date?: string | null
          owner_id: string
          pipeline: Database["public"]["Enums"]["pipeline_type"]
          prevailing_wage?: boolean | null
          priority?: string | null
          project_tag?: string | null
          revisit_date?: string | null
          stage: string
          stage_entered_at?: string | null
          status?: Database["public"]["Enums"]["opp_status"]
          updated_at?: string | null
          win_probability?: number | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          competitor?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          expected_close_date?: string | null
          final_value?: number | null
          gross_profit_pct?: number | null
          id?: string
          job_site_address?: string
          job_site_lat?: number | null
          job_site_lng?: number | null
          lost_reason?: string | null
          name?: string
          next_step?: string | null
          next_step_date?: string | null
          owner_id?: string
          pipeline?: Database["public"]["Enums"]["pipeline_type"]
          prevailing_wage?: boolean | null
          priority?: string | null
          project_tag?: string | null
          revisit_date?: string | null
          stage?: string
          stage_entered_at?: string | null
          status?: Database["public"]["Enums"]["opp_status"]
          updated_at?: string | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_concentration"
            referencedColumns: ["company_id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          opportunity_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: string | null
          id: string
          opportunity_id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          opportunity_id: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          opportunity_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_gov_sync_log: {
        Row: {
          errors: Json | null
          id: string
          naics_codes: string[]
          new_imported: number
          results_found: number
          set_asides: string[] | null
          synced_at: string
          synced_by: string
        }
        Insert: {
          errors?: Json | null
          id?: string
          naics_codes: string[]
          new_imported?: number
          results_found?: number
          set_asides?: string[] | null
          synced_at?: string
          synced_by: string
        }
        Update: {
          errors?: Json | null
          id?: string
          naics_codes?: string[]
          new_imported?: number
          results_found?: number
          set_asides?: string[] | null
          synced_at?: string
          synced_by?: string
        }
        Relationships: []
      }
      usaspending_cache: {
        Row: {
          agency: string | null
          avg_award: number | null
          award_count: number | null
          awards_data: Json
          cached_at: string
          id: string
          median_award: number | null
          naics_code: string
          state: string | null
        }
        Insert: {
          agency?: string | null
          avg_award?: number | null
          award_count?: number | null
          awards_data: Json
          cached_at?: string
          id?: string
          median_award?: number | null
          naics_code: string
          state?: string | null
        }
        Update: {
          agency?: string | null
          avg_award?: number | null
          award_count?: number | null
          awards_data?: Json
          cached_at?: string
          id?: string
          median_award?: number | null
          naics_code?: string
          state?: string | null
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pins_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pins_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_closing_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pins_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_stale_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
    }
    Views: {
      v_bid_out_awaiting: {
        Row: {
          company_name: string | null
          days_until: number | null
          decision_date: string | null
          gc_name: string | null
          opp_id: string | null
          our_number: number | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          project_name: string | null
        }
        Relationships: []
      }
      v_bond_exposure: {
        Row: {
          bond_pct: number | null
          bonded_dollars: number | null
          total_dollars: number | null
        }
        Relationships: []
      }
      v_closed_won_vs_goal: {
        Row: {
          closed_won_ytd: number | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          won_count: number | null
        }
        Relationships: []
      }
      v_closing_this_month: {
        Row: {
          amount: number | null
          company_name: string | null
          expected_close_date: string | null
          id: string | null
          name: string | null
          next_step: string | null
          next_step_date: string | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          stage: string | null
          weighted_amount: number | null
          win_probability: number | null
        }
        Relationships: []
      }
      v_company_kpis: {
        Row: {
          avg_bid_size: number | null
          company_id: string | null
          decided_count: number | null
          total_bid_dollars: number | null
          total_won_dollars: number | null
          win_rate_count: number | null
          win_rate_dollars: number | null
          win_rate_facility: number | null
          win_rate_gc_chase: number | null
          win_rate_public_bid: number | null
          won_count: number | null
        }
        Relationships: []
      }
      v_company_list: {
        Row: {
          address: string | null
          address_line1: string | null
          archived_at: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string | null
          jobs_out_for_bid: number | null
          last_activity_at: string | null
          linkedin_url: string | null
          name: string | null
          notes: string | null
          on_bid_list: boolean | null
          opp_count: number | null
          phone: string | null
          planroom_url: string | null
          region: string | null
          state: string | null
          status: string | null
          type: Database["public"]["Enums"]["company_type"] | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          jobs_out_for_bid?: never
          last_activity_at?: never
          linkedin_url?: string | null
          name?: string | null
          notes?: string | null
          on_bid_list?: boolean | null
          opp_count?: never
          phone?: string | null
          planroom_url?: string | null
          region?: string | null
          state?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["company_type"] | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          jobs_out_for_bid?: never
          last_activity_at?: never
          linkedin_url?: string | null
          name?: string | null
          notes?: string | null
          on_bid_list?: boolean | null
          opp_count?: never
          phone?: string | null
          planroom_url?: string | null
          region?: string | null
          state?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["company_type"] | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      v_customer_concentration: {
        Row: {
          company_id: string | null
          company_name: string | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          won_count: number | null
          won_dollars: number | null
        }
        Relationships: []
      }
      v_outstanding_bid_dollars: {
        Row: {
          opp_count: number | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          total: number | null
        }
        Relationships: []
      }
      v_spread_to_low: {
        Row: {
          avg_spread: number | null
          sample_size: number | null
        }
        Relationships: []
      }
      v_stale_leaks: {
        Row: {
          amount: number | null
          company_name: string | null
          id: string | null
          last_activity_at: string | null
          name: string | null
          next_step_date: string | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          stage: string | null
        }
        Relationships: []
      }
      v_weighted_forecast_90d: {
        Row: {
          close_month: string | null
          committed_count: number | null
          committed_weighted: number | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          total_weighted: number | null
          upside_count: number | null
          upside_weighted: number | null
        }
        Relationships: []
      }
      v_win_rate_by_motion: {
        Row: {
          decided: number | null
          pipeline: Database["public"]["Enums"]["pipeline_type"] | null
          win_rate: number | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_stage: {
        Args: { p_opp_id: string; p_target_stage: string }
        Returns: {
          id: string
          stage: string
          status: Database["public"]["Enums"]["opp_status"]
        }[]
      }
      create_opportunity: {
        Args: {
          p_amount?: number
          p_company_id: string
          p_job_site_address: string
          p_name: string
          p_pipeline: Database["public"]["Enums"]["pipeline_type"]
        }
        Returns: string
      }
      current_app_role: { Args: never; Returns: string }
      delete_opportunity: { Args: { p_opp_id: string }; Returns: undefined }
      find_contacts_by_email: {
        Args: { p_email: string; p_secret: string }
        Returns: {
          id: string
        }[]
      }
      log_gmail_contact_note: {
        Args: {
          p_body: string
          p_contact_id: string
          p_created_at: string
          p_external_id: string
          p_secret: string
        }
        Returns: undefined
      }
      mark_complete: {
        Args: {
          p_completed_at?: string
          p_final_value: number
          p_notes?: string
          p_opp_id: string
        }
        Returns: undefined
      }
      undo_complete: { Args: { p_opp_id: string }; Returns: undefined }
      valid_stage_for_pipeline: {
        Args: { p: Database["public"]["Enums"]["pipeline_type"]; s: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "CALL" | "VISIT" | "PREBID_WALK" | "EMAIL" | "NOTE"
      app_role: "rep" | "owner" | "admin"
      company_type:
        | "GC"
        | "AWARDING_AUTHORITY"
        | "OWNER"
        | "ARCHITECT"
        | "GOVERNMENT_AGENCY"
      contact_role:
        | "PM"
        | "ESTIMATOR"
        | "SUPER"
        | "FM"
        | "PURCHASING"
        | "SPEC_WRITER"
      opp_status: "OPEN" | "WON" | "LOST" | "NURTURE" | "DISQUALIFIED"
      pipeline_type: "PUBLIC_BID" | "GC_CHASE" | "FACILITY" | "FEDERAL"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: ["CALL", "VISIT", "PREBID_WALK", "EMAIL", "NOTE"],
      app_role: ["rep", "owner", "admin"],
      company_type: [
        "GC",
        "AWARDING_AUTHORITY",
        "OWNER",
        "ARCHITECT",
        "GOVERNMENT_AGENCY",
      ],
      contact_role: [
        "PM",
        "ESTIMATOR",
        "SUPER",
        "FM",
        "PURCHASING",
        "SPEC_WRITER",
      ],
      opp_status: ["OPEN", "WON", "LOST", "NURTURE", "DISQUALIFIED"],
      pipeline_type: ["PUBLIC_BID", "GC_CHASE", "FACILITY", "FEDERAL"],
    },
  },
} as const
