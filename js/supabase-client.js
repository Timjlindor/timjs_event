const SUPABASE_URL = "https://zcgwkvuyxosxfyxwmfim.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZ3drdnV5eG9zeGZ5eHdtZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzAyMTksImV4cCI6MjA4NjM0NjIxOX0.x1VNiNBu1N8dshlgwTBBW2_GhUtovSnjQs_mYZuLUgw";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const envWarning = document.getElementById("envWarning");
if (envWarning && location.protocol !== "http:" && location.protocol !== "https:") {
    envWarning.style.display = "block";
}
