export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      creator_profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      published_tour_manifests: {
        Row: {
          content_hash: string;
          id: string;
          manifest: Json;
          published_at: string;
          publish_version: number;
          tour_code: string;
          tour_id: string;
        };
        Insert: {
          content_hash: string;
          id?: string;
          manifest: Json;
          published_at?: string;
          publish_version: number;
          tour_code: string;
          tour_id: string;
        };
        Update: {
          content_hash?: string;
          id?: string;
          manifest?: Json;
          published_at?: string;
          publish_version?: number;
          tour_code?: string;
          tour_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "published_tour_manifests_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          }
        ];
      };
      tour_routes: {
        Row: {
          created_at: string;
          distance_meters: number | null;
          estimated_duration_minutes: number | null;
          id: string;
          line: Json;
          tour_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          distance_meters?: number | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          line: Json;
          tour_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          distance_meters?: number | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          line?: Json;
          tour_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_routes_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: true;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          }
        ];
      };
      tour_stops: {
        Row: {
          audio_asset_path: string | null;
          audio_credit: string | null;
          audio_duration_seconds: number | null;
          audio_file_name: string | null;
          audio_license: string | null;
          audio_mime_type: string | null;
          audio_storage_path: string | null;
          body: string | null;
          coordinate: Json;
          created_at: string;
          id: string;
          stop_number: number;
          summary: string | null;
          title: string;
          tour_id: string;
          updated_at: string;
        };
        Insert: {
          audio_asset_path?: string | null;
          audio_credit?: string | null;
          audio_duration_seconds?: number | null;
          audio_file_name?: string | null;
          audio_license?: string | null;
          audio_mime_type?: string | null;
          audio_storage_path?: string | null;
          body?: string | null;
          coordinate: Json;
          created_at?: string;
          id?: string;
          stop_number: number;
          summary?: string | null;
          title: string;
          tour_id: string;
          updated_at?: string;
        };
        Update: {
          audio_asset_path?: string | null;
          audio_credit?: string | null;
          audio_duration_seconds?: number | null;
          audio_file_name?: string | null;
          audio_license?: string | null;
          audio_mime_type?: string | null;
          audio_storage_path?: string | null;
          body?: string | null;
          coordinate?: Json;
          created_at?: string;
          id?: string;
          stop_number?: number;
          summary?: string | null;
          title?: string;
          tour_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_stops_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          }
        ];
      };
      tours: {
        Row: {
          city: string;
          country_code: string | null;
          created_at: string;
          creator_id: string;
          description: string;
          draft_tour_code: string | null;
          id: string;
          locale: string;
          status: "draft" | "published" | "archived";
          title: string;
          updated_at: string;
        };
        Insert: {
          city: string;
          country_code?: string | null;
          created_at?: string;
          creator_id: string;
          description: string;
          draft_tour_code?: string | null;
          id?: string;
          locale?: string;
          status?: "draft" | "published" | "archived";
          title: string;
          updated_at?: string;
        };
        Update: {
          city?: string;
          country_code?: string | null;
          created_at?: string;
          creator_id?: string;
          description?: string;
          draft_tour_code?: string | null;
          id?: string;
          locale?: string;
          status?: "draft" | "published" | "archived";
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tours_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creator_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      publish_tour_manifest: {
        Args: {
          p_content_hash: string;
          p_creator_id: string;
          p_manifest: Json;
          p_published_at: string;
          p_tour_code: string;
          p_tour_id: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
