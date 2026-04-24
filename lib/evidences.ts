import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClient;

export type Evidence = {
  id: string;
  company_id: string;
  pdca_id: string;
  sub_action_id: string;
  file_name: string;
  file_type: string;
  file_url: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export async function fetchEvidences(
  pdcaId: string,
  subActionId: string
): Promise<Evidence[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("pdca_evidences")
      .select("*")
      .eq("pdca_id", pdcaId)
      .eq("sub_action_id", subActionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching evidences:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

export async function uploadEvidence(
  pdcaId: string,
  subActionId: string,
  file: File
): Promise<Evidence | null> {
  if (!supabase) return null;

  const fileType = file.name.split(".").pop()?.toLowerCase() || "";
  const fileName = file.name;
  const filePath = `${pdcaId}/${subActionId}/${Date.now()}_${fileName}`;

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pdca-evidences")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file to storage:", uploadError);
    }

    const { data: urlData } = supabase.storage
      .from("pdca-evidences")
      .getPublicUrl(filePath);

    const { data: dbData, error: dbError } = await supabase
      .from("pdca_evidences")
      .insert({
        pdca_id: pdcaId,
        sub_action_id: subActionId,
        file_name: fileName,
        file_type: fileType,
        file_url: urlData.publicUrl,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving evidence to DB:", dbError);
      return null;
    }

    return dbData;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
}

export async function deleteEvidence(id: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("pdca_evidences").delete().eq("id", id);

    if (error) {
      console.error("Error deleting evidence:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Delete error:", err);
    return false;
  }
}