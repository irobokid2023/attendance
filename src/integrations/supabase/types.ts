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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          section: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          section: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          section?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          academic_year: string
          app_name: string
          default_class_duration_minutes: number
          id: string
          notify_attendance_reminders: boolean
          notify_holiday_alerts: boolean
          primary_color: string
          reminder_time: string
          singleton: boolean
          tagline: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string
          app_name?: string
          default_class_duration_minutes?: number
          id?: string
          notify_attendance_reminders?: boolean
          notify_holiday_alerts?: boolean
          primary_color?: string
          reminder_time?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          app_name?: string
          default_class_duration_minutes?: number
          id?: string
          notify_attendance_reminders?: boolean
          notify_holiday_alerts?: boolean
          primary_color?: string
          reminder_time?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          status: string
          student_id: string
          topic: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          status: string
          student_id: string
          topic?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          status?: string
          student_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          day: string | null
          div: string | null
          grade: string | null
          id: string
          instructor_names: string | null
          name: string
          num_sessions: number | null
          school_id: string
          teacher_id: string | null
          timing: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          day?: string | null
          div?: string | null
          grade?: string | null
          id?: string
          instructor_names?: string | null
          name: string
          num_sessions?: number | null
          school_id: string
          teacher_id?: string | null
          timing?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          day?: string | null
          div?: string | null
          grade?: string | null
          id?: string
          instructor_names?: string | null
          name?: string
          num_sessions?: number | null
          school_id?: string
          teacher_id?: string | null
          timing?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          program_name: string
          session_no: number
          topic_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          program_name: string
          session_no: number
          topic_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          program_name?: string
          session_no?: number
          topic_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      flite_class_observations: {
        Row: {
          course: string | null
          created_at: string
          flite_teacher_name: string | null
          hours: string | null
          id: string
          remarks: string | null
          school_id: string
          school_teacher: string | null
          session_date: string | null
          updated_at: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          remarks?: string | null
          school_id: string
          school_teacher?: string | null
          session_date?: string | null
          updated_at?: string
        }
        Update: {
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          remarks?: string | null
          school_id?: string
          school_teacher?: string | null
          session_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_class_observations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_kit_deliveries: {
        Row: {
          checked_by: string | null
          couriered_date: string | null
          created_at: string
          id: string
          prepared_by: string | null
          program_name: string | null
          quantity: number | null
          received_on: string | null
          school_id: string
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          checked_by?: string | null
          couriered_date?: string | null
          created_at?: string
          id?: string
          prepared_by?: string | null
          program_name?: string | null
          quantity?: number | null
          received_on?: string | null
          school_id: string
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          checked_by?: string | null
          couriered_date?: string | null
          created_at?: string
          id?: string
          prepared_by?: string | null
          program_name?: string | null
          quantity?: number | null
          received_on?: string | null
          school_id?: string
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_kit_deliveries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_programs: {
        Row: {
          course_name: string | null
          created_at: string
          curriculum_file_link: string | null
          divisions_per_grade: number | null
          grade: string | null
          id: string
          kit_cost: number | null
          kit_student_sharing: string | null
          no_of_kits: number | null
          school_id: string
          shelf_life: string | null
          updated_at: string
        }
        Insert: {
          course_name?: string | null
          created_at?: string
          curriculum_file_link?: string | null
          divisions_per_grade?: number | null
          grade?: string | null
          id?: string
          kit_cost?: number | null
          kit_student_sharing?: string | null
          no_of_kits?: number | null
          school_id: string
          shelf_life?: string | null
          updated_at?: string
        }
        Update: {
          course_name?: string | null
          created_at?: string
          curriculum_file_link?: string | null
          divisions_per_grade?: number | null
          grade?: string | null
          id?: string
          kit_cost?: number | null
          kit_student_sharing?: string | null
          no_of_kits?: number | null
          school_id?: string
          shelf_life?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_refresher_sessions: {
        Row: {
          course: string | null
          created_at: string
          flite_teacher_name: string | null
          hours: string | null
          id: string
          mode: string | null
          school_id: string
          session_date: string | null
          teachers_attended: number | null
          updated_at: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          mode?: string | null
          school_id: string
          session_date?: string | null
          teachers_attended?: number | null
          updated_at?: string
        }
        Update: {
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          mode?: string | null
          school_id?: string
          session_date?: string | null
          teachers_attended?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_refresher_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_school_teachers: {
        Row: {
          courses: string | null
          created_at: string
          full_name: string | null
          id: string
          school_id: string
          subjects: string | null
          updated_at: string
        }
        Insert: {
          courses?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          school_id: string
          subjects?: string | null
          updated_at?: string
        }
        Update: {
          courses?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          school_id?: string
          subjects?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_school_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_schools: {
        Row: {
          address: string | null
          city: string | null
          contact_no: string | null
          created_at: string
          id: string
          invoice_name: string | null
          kit_delivery_date: string | null
          mktg_coord_contact: string | null
          mktg_coord_email: string | null
          mktg_coord_name: string | null
          name: string
          notes: string | null
          owner_id: string | null
          payment_terms: string | null
          principal_contact: string | null
          principal_email: string | null
          principal_name: string | null
          region: string | null
          school_coord_contact: string | null
          school_coord_email: string | null
          school_coord_name: string | null
          school_full_name: string | null
          status: Database["public"]["Enums"]["flite_status"]
          teachers_count: number | null
          tier: string | null
          training_dates: string | null
          training_days_committed: string | null
          training_mode: string | null
          updated_at: string
          welcome_kit_delivered_date: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_no?: string | null
          created_at?: string
          id?: string
          invoice_name?: string | null
          kit_delivery_date?: string | null
          mktg_coord_contact?: string | null
          mktg_coord_email?: string | null
          mktg_coord_name?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          principal_contact?: string | null
          principal_email?: string | null
          principal_name?: string | null
          region?: string | null
          school_coord_contact?: string | null
          school_coord_email?: string | null
          school_coord_name?: string | null
          school_full_name?: string | null
          status?: Database["public"]["Enums"]["flite_status"]
          teachers_count?: number | null
          tier?: string | null
          training_dates?: string | null
          training_days_committed?: string | null
          training_mode?: string | null
          updated_at?: string
          welcome_kit_delivered_date?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_no?: string | null
          created_at?: string
          id?: string
          invoice_name?: string | null
          kit_delivery_date?: string | null
          mktg_coord_contact?: string | null
          mktg_coord_email?: string | null
          mktg_coord_name?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          principal_contact?: string | null
          principal_email?: string | null
          principal_name?: string | null
          region?: string | null
          school_coord_contact?: string | null
          school_coord_email?: string | null
          school_coord_name?: string | null
          school_full_name?: string | null
          status?: Database["public"]["Enums"]["flite_status"]
          teachers_count?: number | null
          tier?: string | null
          training_dates?: string | null
          training_days_committed?: string | null
          training_mode?: string | null
          updated_at?: string
          welcome_kit_delivered_date?: string | null
        }
        Relationships: []
      }
      flite_trainings: {
        Row: {
          certificates_given_date: string | null
          course: string | null
          created_at: string
          flite_teacher_name: string | null
          hours: string | null
          id: string
          mode: string | null
          school_id: string
          session_date: string | null
          teachers_attended: number | null
          updated_at: string
        }
        Insert: {
          certificates_given_date?: string | null
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          mode?: string | null
          school_id: string
          session_date?: string | null
          teachers_attended?: number | null
          updated_at?: string
        }
        Update: {
          certificates_given_date?: string | null
          course?: string | null
          created_at?: string
          flite_teacher_name?: string | null
          hours?: string | null
          id?: string
          mode?: string | null
          school_id?: string
          session_date?: string | null
          teachers_attended?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_trainings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flite_welcome_deliveries: {
        Row: {
          created_at: string
          date_delivered: string | null
          delivered_by: string | null
          delivered_to: string | null
          id: string
          items: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_delivered?: string | null
          delivered_by?: string | null
          delivered_to?: string | null
          id?: string
          items?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_delivered?: string | null
          delivered_by?: string | null
          delivered_to?: string | null
          id?: string
          items?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flite_welcome_deliveries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "flite_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grading: {
        Row: {
          class_id: string
          created_at: string
          date: string
          grade_value: string
          id: string
          marked_by: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          grade_value: string
          id?: string
          marked_by?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          grade_value?: string
          id?: string
          marked_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_attendance: {
        Row: {
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          instructor_id: string
          location: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          instructor_id: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          instructor_id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_curriculum_programs: {
        Row: {
          age_group: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_weeks: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_weeks?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_weeks?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_curriculum_sessions: {
        Row: {
          activities: string | null
          created_at: string
          id: string
          materials: string | null
          objectives: string | null
          program_id: string
          session_no: number
          title: string
        }
        Insert: {
          activities?: string | null
          created_at?: string
          id?: string
          materials?: string | null
          objectives?: string | null
          program_id: string
          session_no: number
          title: string
        }
        Update: {
          activities?: string | null
          created_at?: string
          id?: string
          materials?: string | null
          objectives?: string | null
          program_id?: string
          session_no?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_curriculum_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "marketing_curriculum_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_school_contacts: {
        Row: {
          created_at: string
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          school_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          school_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          school_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_school_contacts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "marketing_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_school_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          school_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          school_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_school_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "marketing_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_schools: {
        Row: {
          address: string | null
          area: string | null
          board: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          board?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          board?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      marketing_visits: {
        Row: {
          agenda: string | null
          amount: number | null
          coordinator_id: string | null
          created_at: string
          created_by: string | null
          id: string
          next_follow_up: string | null
          notes: string | null
          outcome: string | null
          school_id: string
          status: Database["public"]["Enums"]["marketing_visit_status"]
          updated_at: string
          visit_date: string
        }
        Insert: {
          agenda?: string | null
          amount?: number | null
          coordinator_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          outcome?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["marketing_visit_status"]
          updated_at?: string
          visit_date?: string
        }
        Update: {
          agenda?: string | null
          amount?: number | null
          coordinator_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          outcome?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["marketing_visit_status"]
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "marketing_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      misc_tasks: {
        Row: {
          created_at: string
          id: string
          marked_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["misc_task_status"]
          task_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["misc_task_status"]
          task_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["misc_task_status"]
          task_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          title?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          days: string[] | null
          id: string
          ir_coordinator_mobile: string | null
          ir_coordinator_name: string | null
          name: string
          primary_coordinator_mobile: string | null
          primary_coordinator_name: string | null
          secondary_coordinator_mobile: string | null
          secondary_coordinator_name: string | null
          transport_mode: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name?: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          div: string | null
          full_name: string
          grade: string | null
          id: string
          laptop_no: string | null
          parent_email_1: string | null
          parent_email_2: string | null
          parent_mobile_1: string | null
          parent_mobile_2: string | null
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          div?: string | null
          full_name: string
          grade?: string | null
          id?: string
          laptop_no?: string | null
          parent_email_1?: string | null
          parent_email_2?: string | null
          parent_mobile_1?: string | null
          parent_mobile_2?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          div?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          laptop_no?: string | null
          parent_email_1?: string | null
          parent_email_2?: string | null
          parent_mobile_1?: string | null
          parent_mobile_2?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          topic: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          topic: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      delete_old_activity_logs: { Args: never; Returns: undefined }
      delete_old_topics: { Args: never; Returns: undefined }
      get_table_sizes: {
        Args: never
        Returns: {
          index_bytes: number
          row_estimate: number
          table_bytes: number
          table_name: string
          total_bytes: number
        }[]
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "instructor" | "admin"
      flite_status: "prospect" | "active" | "paused" | "churned"
      marketing_visit_status:
        | "interested"
        | "follow_up"
        | "deal_closed"
        | "not_interested"
      misc_task_status: "done" | "pending" | "not_applicable" | "granted"
      payment_status: "paid" | "not_paid"
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
      app_role: ["instructor", "admin"],
      flite_status: ["prospect", "active", "paused", "churned"],
      marketing_visit_status: [
        "interested",
        "follow_up",
        "deal_closed",
        "not_interested",
      ],
      misc_task_status: ["done", "pending", "not_applicable", "granted"],
      payment_status: ["paid", "not_paid"],
    },
  },
} as const
