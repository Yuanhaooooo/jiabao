// supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xrnegvlpjpdokastipsx.supabase.co";
const supabaseAnonKey = "sb_publishable_eR5sllX_gaKbR-BTEILo5g_4epvth6G";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
