// =============================================================================
// Synchronisation YouTube → Site  (Réseaux → Site)
// -----------------------------------------------------------------------------
// Récupère les dernières vidéos de la chaîne via le flux RSS public de YouTube
// (aucune clé API nécessaire) et les upsert dans la table `social_posts` de
// Supabase. Le site (index.html) affiche déjà cette table dans son fil.
//
// Secrets nécessaires (GitHub → Settings → Secrets → Actions) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// L'ID de chaîne a une valeur par défaut (modifiable via YOUTUBE_CHANNEL_ID).
// =============================================================================

const env = process.env;
const CHANNEL_ID = env.YOUTUBE_CHANNEL_ID || "UCMEaH-POIzzcwStRZ33KqjA"; // Timj's Photography
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const log = (...a) => console.log("•", ...a);

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
    process.exit(1);
}

// Décode les entités XML de base.
function decode(s) {
    return (s || "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
}

function field(block, tag) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? decode(m[1]) : null;
}

async function main() {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    log("Lecture du flux YouTube :", rssUrl);
    const xml = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());

    const entries = xml.split("<entry>").slice(1).map((e) => "<entry>" + e);
    const rows = entries.map((e) => {
        const videoId = field(e, "yt:videoId");
        const linkMatch = e.match(/<link[^>]*href="([^"]+)"/);
        const thumbMatch = e.match(/<media:thumbnail[^>]*url="([^"]+)"/);
        return {
            platform: "youtube",
            external_id: videoId,
            title: field(e, "title"),
            body: field(e, "media:description"),
            media_url: null,
            thumbnail_url: thumbMatch ? thumbMatch[1] : null,
            permalink: linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`,
            published_at: field(e, "published"),
            media_type: "video",
            video_embed_url: `https://www.youtube.com/embed/${videoId}`,
            like_count: null,
            comment_count: null,
        };
    }).filter((r) => r.external_id);

    if (rows.length === 0) {
        log("Aucune vidéo trouvée dans le flux.");
        return;
    }
    log(`${rows.length} vidéos récupérées. Envoi vers Supabase…`);

    // Upsert (sur la contrainte unique platform + external_id).
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/social_posts?on_conflict=platform,external_id`,
        {
            method: "POST",
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(rows),
        }
    );
    if (res.ok) log(`OK — ${rows.length} vidéos YouTube synchronisées sur le site.`);
    else { console.error("Échec Supabase :", res.status, await res.text()); process.exit(1); }
}

main().catch((e) => { console.error("ÉCHEC :", e); process.exit(1); });
