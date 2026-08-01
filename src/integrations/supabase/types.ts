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
      assignment_submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          feedback_ar: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          graded_at: string | null
          id: string
          notes: string | null
          score: number | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          feedback_ar?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          graded_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          feedback_ar?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          graded_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          deadline: string | null
          description: string | null
          description_ar: string | null
          id: string
          is_active: boolean
          max_score: number
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          max_score?: number
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          max_score?: number
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_type: string
          created_at: string
          description: string | null
          description_ar: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string
          points_reward: number
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          badge_type?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
          points_reward?: number
          requirement_type?: string
          requirement_value?: number
        }
        Update: {
          badge_type?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          points_reward?: number
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      bundle_courses: {
        Row: {
          bundle_id: string
          course_id: string
          created_at: string
          id: string
          sort_order: number
        }
        Insert: {
          bundle_id: string
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_courses_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_purchases: {
        Row: {
          amount_paid: number
          bundle_id: string
          expires_at: string | null
          id: string
          payment_id: string | null
          purchased_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          bundle_id: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          purchased_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          bundle_id?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          purchased_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_purchases_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          id: string
          issued_at: string | null
          pdf_url: string | null
          user_id: string
          verification_token: string | null
        }
        Insert: {
          certificate_number: string
          course_id: string
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          user_id: string
          verification_token?: string | null
        }
        Update: {
          certificate_number?: string
          course_id?: string
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          user_id?: string
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_files: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          sort_order: number
          title: string
          title_ar: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_files_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
          title_ar: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string
          university_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar: string
          university_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colleges_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          discount_amount: number
          id: string
          payment_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_amount: number
          id?: string
          payment_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_amount?: number
          id?: string
          payment_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          course_id: string | null
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          description_ar: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          max_uses: number | null
          min_order_amount: number | null
        }
        Insert: {
          code: string
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          description_ar?: string | null
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
        }
        Update: {
          code?: string
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          description_ar?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_bundles: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean
          original_price: number | null
          price: number
          thumbnail_url: string | null
          title: string
          title_ar: string
          updated_at: string
          valid_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          original_price?: number | null
          price: number
          thumbnail_url?: string | null
          title: string
          title_ar: string
          updated_at?: string
          valid_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          original_price?: number | null
          price?: number
          thumbnail_url?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
          valid_days?: number | null
        }
        Relationships: []
      }
      course_discussions: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          reply_count: number
          title: string
          title_ar: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reply_count?: number
          title: string
          title_ar?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reply_count?: number
          title?: string
          title_ar?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_discussions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_messages: {
        Row: {
          content: string | null
          course_id: string
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_messages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string | null
          id: string
          rating: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          rating: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_enabled: boolean | null
          approval_status: string | null
          category: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          duration_hours: number | null
          enabled_payment_methods: string[]
          expected_students: number | null
          id: string
          instructor_commission: number | null
          instructor_id: string | null
          is_active: boolean | null
          is_approved: boolean | null
          is_featured: boolean | null
          learning_outcomes: string[]
          learning_outcomes_ar: string[]
          major_id: string | null
          original_price: number | null
          price: number | null
          price_includes_tax: boolean
          rejection_reason: string | null
          slug: string | null
          study_year: string | null
          subject_code: string | null
          subject_name: string | null
          thumbnail_url: string | null
          title: string
          title_ar: string
          updated_at: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          approval_status?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          duration_hours?: number | null
          enabled_payment_methods?: string[]
          expected_students?: number | null
          id?: string
          instructor_commission?: number | null
          instructor_id?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          is_featured?: boolean | null
          learning_outcomes?: string[]
          learning_outcomes_ar?: string[]
          major_id?: string | null
          original_price?: number | null
          price?: number | null
          price_includes_tax?: boolean
          rejection_reason?: string | null
          slug?: string | null
          study_year?: string | null
          subject_code?: string | null
          subject_name?: string | null
          thumbnail_url?: string | null
          title: string
          title_ar: string
          updated_at?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          approval_status?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          duration_hours?: number | null
          enabled_payment_methods?: string[]
          expected_students?: number | null
          id?: string
          instructor_commission?: number | null
          instructor_id?: string | null
          is_active?: boolean | null
          is_approved?: boolean | null
          is_featured?: boolean | null
          learning_outcomes?: string[]
          learning_outcomes_ar?: string[]
          major_id?: string | null
          original_price?: number | null
          price?: number | null
          price_includes_tax?: boolean
          rejection_reason?: string | null
          slug?: string | null
          study_year?: string | null
          subject_code?: string | null
          subject_name?: string | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_course_requests: {
        Row: {
          academic_year: string | null
          assigned_instructor_id: string | null
          assigned_production_id: string | null
          assigned_secretary_id: string | null
          course_name: string | null
          created_at: string | null
          deadline: string | null
          deadline_warning_sent: boolean | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          description: string | null
          doctor_name: string | null
          estimated_price: number | null
          final_price: number | null
          id: string
          institution: string | null
          last_status_update: string | null
          notes: string | null
          section: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          assigned_instructor_id?: string | null
          assigned_production_id?: string | null
          assigned_secretary_id?: string | null
          course_name?: string | null
          created_at?: string | null
          deadline?: string | null
          deadline_warning_sent?: boolean | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          description?: string | null
          doctor_name?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          institution?: string | null
          last_status_update?: string | null
          notes?: string | null
          section?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          assigned_instructor_id?: string | null
          assigned_production_id?: string | null
          assigned_secretary_id?: string | null
          course_name?: string | null
          created_at?: string | null
          deadline?: string | null
          deadline_warning_sent?: boolean | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          description?: string | null
          doctor_name?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          institution?: string | null
          last_status_update?: string | null
          notes?: string | null
          section?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_info: Json | null
          id: string
          is_active: boolean
          last_seen_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          content: string
          created_at: string
          discussion_id: string
          id: string
          is_answer: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          discussion_id: string
          id?: string
          is_answer?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          discussion_id?: string
          id?: string
          is_answer?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "course_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string | null
          expires_at: string | null
          id: string
          paid_percentage: number
          progress: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          paid_percentage?: number
          progress?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          paid_percentage?: number
          progress?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_profiles: {
        Row: {
          created_at: string
          current_level: number
          id: string
          last_activity_date: string | null
          streak_days: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instructor_earnings: {
        Row: {
          amount: number
          commission_rate: number | null
          course_id: string | null
          created_at: string | null
          id: string
          instructor_id: string
          paid_at: string | null
          payment_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          commission_rate?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          commission_rate?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_earnings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attachments: {
        Row: {
          created_at: string
          file_category: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lesson_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_category?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lesson_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_category?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lesson_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          last_position: number | null
          lesson_id: string
          progress_percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id: string
          progress_percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id?: string
          progress_percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_transcripts: {
        Row: {
          generated_at: string
          id: string
          language: string | null
          lesson_id: string
          status: string
          transcript: string
        }
        Insert: {
          generated_at?: string
          id?: string
          language?: string | null
          lesson_id: string
          status?: string
          transcript: string
        }
        Update: {
          generated_at?: string
          id?: string
          language?: string | null
          lesson_id?: string
          status?: string
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcripts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_live: boolean | null
          is_preview: boolean | null
          live_date: string | null
          live_url: string | null
          sort_order: number | null
          title: string
          title_ar: string
          video_url: string | null
          video_url_1080p: string | null
          video_url_480p: string | null
          video_url_720p: string | null
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_live?: boolean | null
          is_preview?: boolean | null
          live_date?: string | null
          live_url?: string | null
          sort_order?: number | null
          title: string
          title_ar: string
          video_url?: string | null
          video_url_1080p?: string | null
          video_url_480p?: string | null
          video_url_720p?: string | null
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_live?: boolean | null
          is_preview?: boolean | null
          live_date?: string | null
          live_url?: string | null
          sort_order?: number | null
          title?: string
          title_ar?: string
          video_url?: string | null
          video_url_1080p?: string | null
          video_url_480p?: string | null
          video_url_720p?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      majors: {
        Row: {
          college_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string
        }
        Insert: {
          college_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar: string
        }
        Update: {
          college_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "majors_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          message_ar: string | null
          title: string
          title_ar: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          message_ar?: string | null
          title: string
          title_ar?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          message_ar?: string | null
          title?: string
          title_ar?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          course_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          installment_plan: Json | null
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          tabby_payment_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_plan?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          tabby_payment_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          installment_plan?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          tabby_payment_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "custom_course_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_degree: string | null
          academic_year: string | null
          allow_multiple_devices: boolean | null
          availability_to_start: string | null
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          created_at: string | null
          date_of_birth: string | null
          education_status: string | null
          email: string | null
          expected_students_count: number | null
          full_name: string | null
          full_name_ar: string | null
          gender: string | null
          has_accepted_policies: boolean | null
          id: string
          is_banned: boolean | null
          major_id: string | null
          nationality: string | null
          offers_research_services: boolean | null
          phone: string | null
          preferred_language: string | null
          referral_source: string | null
          research_participation: boolean | null
          residence_country: string | null
          specialty: string | null
          study_year: string | null
          teaching_experience_details: string | null
          teaching_experience_years: string | null
          teaching_year: string | null
          university_id: string | null
          updated_at: string | null
        }
        Insert: {
          academic_degree?: string | null
          academic_year?: string | null
          allow_multiple_devices?: boolean | null
          availability_to_start?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          education_status?: string | null
          email?: string | null
          expected_students_count?: number | null
          full_name?: string | null
          full_name_ar?: string | null
          gender?: string | null
          has_accepted_policies?: boolean | null
          id: string
          is_banned?: boolean | null
          major_id?: string | null
          nationality?: string | null
          offers_research_services?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          referral_source?: string | null
          research_participation?: boolean | null
          residence_country?: string | null
          specialty?: string | null
          study_year?: string | null
          teaching_experience_details?: string | null
          teaching_experience_years?: string | null
          teaching_year?: string | null
          university_id?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_degree?: string | null
          academic_year?: string | null
          allow_multiple_devices?: boolean | null
          availability_to_start?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          education_status?: string | null
          email?: string | null
          expected_students_count?: number | null
          full_name?: string | null
          full_name_ar?: string | null
          gender?: string | null
          has_accepted_policies?: boolean | null
          id?: string
          is_banned?: boolean | null
          major_id?: string | null
          nationality?: string | null
          offers_research_services?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          referral_source?: string | null
          research_participation?: boolean | null
          residence_country?: string | null
          specialty?: string | null
          study_year?: string | null
          teaching_experience_details?: string | null
          teaching_experience_years?: string | null
          teaching_year?: string | null
          university_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string
          difficulty: string
          id: string
          instructor_id: string
          question: string
          question_ar: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string
          difficulty?: string
          id?: string
          instructor_id: string
          question?: string
          question_ar?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          instructor_id?: string
          question?: string
          question_ar?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          option_text_ar: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text?: string
          option_text_ar?: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          option_text_ar?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string
          id: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          quiz_id: string
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          option_text_ar: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text?: string
          option_text_ar?: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          option_text_ar?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          id: string
          question: string
          question_ar: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          question?: string
          question_ar?: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          question?: string
          question_ar?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          file_url: string | null
          id: string
          quiz_type: string
          sort_order: number
          title: string
          title_ar: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          quiz_type?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          quiz_type?: string
          sort_order?: number
          title?: string
          title_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          commission_rate: number
          created_at: string
          id: string
          is_active: boolean
          total_earnings: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          referral_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referral_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referral_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          commission_amount: number | null
          converted_at: string | null
          created_at: string
          id: string
          payment_id: string | null
          referral_code_id: string
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          commission_amount?: number | null
          converted_at?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          referral_code_id: string
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          commission_amount?: number | null
          converted_at?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          referral_code_id?: string
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      request_files: {
        Row: {
          ai_classification: Json | null
          created_at: string | null
          file_category: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          request_id: string
        }
        Insert: {
          ai_classification?: Json | null
          created_at?: string | null
          file_category?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          request_id: string
        }
        Update: {
          ai_classification?: Json | null
          created_at?: string | null
          file_category?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "custom_course_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          request_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          request_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "custom_course_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_capture_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          lesson_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          attempt_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          lesson_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          attempt_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          lesson_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screen_capture_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      study_planner: {
        Row: {
          course_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          is_completed: boolean
          notes: string | null
          reminder_sent: boolean
          scheduled_date: string
          scheduled_time: string | null
          title: string
          title_ar: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          reminder_sent?: boolean
          scheduled_date: string
          scheduled_time?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          reminder_sent?: boolean
          scheduled_date?: string
          scheduled_time?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_planner_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chats: {
        Row: {
          created_at: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          session_id: string
          status: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          session_id: string
          status?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_internal: boolean
          chat_id: string
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          admin_internal?: boolean
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          admin_internal?: boolean
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          name_ar: string
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          name_ar: string
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          name_ar?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_access_logs: {
        Row: {
          accessed_at: string | null
          id: string
          ip_address: string | null
          lesson_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string | null
          id?: string
          ip_address?: string | null
          lesson_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string | null
          id?: string
          ip_address?: string | null
          lesson_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_access_logs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_notes: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          note_text: string
          timestamp_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          note_text: string
          timestamp_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          note_text?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_holder_name: string | null
          amount: number
          bank_name: string | null
          iban: string | null
          id: string
          instructor_id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_at: string
          status: string
        }
        Insert: {
          account_holder_name?: string | null
          amount: number
          bank_name?: string | null
          iban?: string | null
          id?: string
          instructor_id: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          account_holder_name?: string | null
          amount?: number
          bank_name?: string | null
          iban?: string | null
          id?: string
          instructor_id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_request_deadlines: { Args: never; Returns: undefined }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      delete_course_cascade: { Args: { course_uuid: string }; Returns: boolean }
      delete_user_cascade: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      generate_referral_code: { Args: never; Returns: string }
      get_admin_stats: { Args: never; Returns: Json }
      get_course_enrollment_counts: {
        Args: never
        Returns: {
          count: number
          course_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_newly_registered_user: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      lookup_referral_code: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
          is_active: boolean
        }[]
      }
      recalc_course_duration: {
        Args: { _course_id: string }
        Returns: undefined
      }
      reset_all_accounts: { Args: never; Returns: boolean }
      reset_user_device: { Args: { target_user_id: string }; Returns: boolean }
      use_coupon: {
        Args: {
          p_coupon_id: string
          p_discount_amount: number
          p_payment_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_has_course_access: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      validate_coupon: {
        Args: {
          p_code: string
          p_course_id?: string
          p_order_amount?: number
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      delivery_method: "zoom_live" | "meet_live" | "recorded"
      payment_method: "online" | "tabby" | "bank_transfer" | "manual"
      payment_status: "pending" | "paid" | "partial" | "failed" | "refunded"
      task_status:
        | "pending"
        | "in_progress"
        | "delayed"
        | "urgent"
        | "completed"
      user_role: "student" | "instructor" | "secretary" | "production" | "admin"
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
      delivery_method: ["zoom_live", "meet_live", "recorded"],
      payment_method: ["online", "tabby", "bank_transfer", "manual"],
      payment_status: ["pending", "paid", "partial", "failed", "refunded"],
      task_status: ["pending", "in_progress", "delayed", "urgent", "completed"],
      user_role: ["student", "instructor", "secretary", "production", "admin"],
    },
  },
} as const
