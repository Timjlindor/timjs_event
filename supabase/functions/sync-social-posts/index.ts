// Récupère les dernières publications YouTube / Facebook / Instagram /
// TikTok et les upsert dans public.social_posts, avec le type de média,
// l'URL d'intégration du lecteur natif, et les compteurs réels de likes
// et commentaires. Déclenchée par pg_cron (voir supabase/schema.sql,
// section 4) ou appelée manuellement pour tester : voir
// CONFIGURATION-SUPABASE.md.
//
// Secrets attendus (Project Settings → Edge Functions → Secrets) :
//   YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN
//   IG_USER_ID  (IG_ACCESS_TOKEN optionnel, sinon réutilise FB_PAGE_ACCESS_TOKEN)
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
// Une plateforme sans ses variables est simplement ignorée (pas d'erreur).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type SocialPost = {
    platform: "youtube" | "facebook" | "instagram" | "tiktok";
    external_id: string;
    title: string | null;
    body: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
    permalink: string;
    published_at: string;
    media_type: "photo" | "video" | "text";
    video_embed_url: string | null;
    like_count: number | null;
    comment_count: number | null;
};

// Les réseaux sociaux (surtout Facebook, copié-collé depuis d'autres apps)
// laissent parfois des caractères invisibles ou de mise en forme (marques
// bidi, caractère de remplacement d'objet) qui s'affichent comme des
// carrés glitchés sur le site. On les retire avant stockage.
const INVISIBLE_CHARS_RE = new RegExp(
    "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" + // contrôles (hors \t \n)
    "\\u200B-\\u200F" + // espaces/marques de largeur nulle
    "\\u2028-\\u202E" + // séparateurs de ligne, marques bidi
    "\\u2060-\\u2069" + // isolats bidi, soudure de mots
    "\\uFFF9-\\uFFFC" + // annotations, caractère de remplacement d'objet
    "\\uFFFE\\uFFFF]",  // non-caractères
    "g"
);

function sanitizeText(text: string | null | undefined): string | null {
    if (!text) return null;
    const cleaned = text.replace(INVISIBLE_CHARS_RE, "").trim();
    return cleaned || null;
}

async function upsertPosts(rows: SocialPost[]) {
    if (rows.length === 0) return;
    const { error } = await supabase
        .from("social_posts")
        .upsert(rows, { onConflict: "platform,external_id" });
    if (error) console.error("upsert error:", error.message);
}

async function syncYouTube() {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    const channelId = Deno.env.get("YOUTUBE_CHANNEL_ID");
    if (!apiKey || !channelId) return;

    const channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
        console.error("youtube: uploads playlist introuvable", channelData);
        return;
    }

    const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=10&key=${apiKey}`
    );
    const itemsData = await itemsRes.json();
    const items = itemsData.items || [];

    const videoIds = items.map((item: any) => item.snippet.resourceId.videoId).join(",");
    let statsById: Record<string, { likeCount?: string; commentCount?: string }> = {};
    if (videoIds) {
        const statsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
        );
        const statsData = await statsRes.json();
        for (const v of statsData.items || []) {
            statsById[v.id] = v.statistics || {};
        }
    }

    const rows: SocialPost[] = items.map((item: any) => {
        const videoId = item.snippet.resourceId.videoId;
        const stats = statsById[videoId] || {};
        return {
            platform: "youtube",
            external_id: videoId,
            title: sanitizeText(item.snippet.title),
            body: sanitizeText(item.snippet.description ? item.snippet.description.slice(0, 500) : null),
            media_url: null,
            thumbnail_url: item.snippet.thumbnails?.medium?.url || null,
            permalink: `https://www.youtube.com/watch?v=${videoId}`,
            published_at: item.snippet.publishedAt,
            media_type: "video",
            video_embed_url: `https://www.youtube.com/embed/${videoId}`,
            like_count: stats.likeCount != null ? Number(stats.likeCount) : null,
            comment_count: stats.commentCount != null ? Number(stats.commentCount) : null,
        };
    });
    await upsertPosts(rows);
}

// Note : les likes et commentaires Facebook ne sont volontairement pas
// récupérés ici. L'API les réserve aux permissions pages_read_engagement
// et pages_read_user_content, qui exigent une App Review Meta et une
// vérification d'entreprise. Le site affiche donc les publications
// Facebook via le plugin officiel (voir index.html), qui montre les vrais
// compteurs sans aucune permission. like_count/comment_count restent null
// pour cette plateforme.
async function syncFacebook() {
    const pageId = Deno.env.get("FB_PAGE_ID");
    const token = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
    if (!pageId || !token) return;

    const fields = "id,message,full_picture,permalink_url,created_time,attachments{type}";
    const res = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/posts?fields=${encodeURIComponent(fields)}&limit=10&access_token=${token}`
    );
    const data = await res.json();
    if (data.error) {
        console.error("facebook error:", data.error);
        return;
    }

    const rows: SocialPost[] = (data.data || [])
        .filter((post: any) => post.message || post.full_picture)
        .map((post: any) => {
            const attachType: string = post.attachments?.data?.[0]?.type || "";
            const isVideo = attachType.includes("video");
            return {
                platform: "facebook",
                external_id: post.id,
                title: null,
                body: sanitizeText(post.message),
                media_url: null,
                thumbnail_url: post.full_picture || null,
                permalink: post.permalink_url,
                published_at: post.created_time,
                media_type: isVideo ? "video" : (post.full_picture ? "photo" : "text"),
                video_embed_url: isVideo
                    ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(post.permalink_url)}&show_text=false`
                    : null,
                like_count: post.likes?.summary?.total_count ?? null,
                comment_count: post.comments?.summary?.total_count ?? null,
            };
        });
    await upsertPosts(rows);
}

async function syncInstagram() {
    const igUserId = Deno.env.get("IG_USER_ID");
    const token = Deno.env.get("IG_ACCESS_TOKEN") || Deno.env.get("FB_PAGE_ACCESS_TOKEN");
    if (!igUserId || !token) return;

    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count";
    const res = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media?fields=${fields}&limit=10&access_token=${token}`
    );
    const data = await res.json();
    if (data.error) {
        console.error("instagram error:", data.error);
        return;
    }

    const rows: SocialPost[] = (data.data || []).map((post: any) => {
        const isVideo = post.media_type === "VIDEO";
        const permalink: string = post.permalink;
        return {
            platform: "instagram",
            external_id: post.id,
            title: null,
            body: sanitizeText(post.caption ? post.caption.slice(0, 500) : null),
            media_url: post.media_url || null,
            thumbnail_url: post.thumbnail_url || post.media_url || null,
            permalink,
            published_at: post.timestamp,
            media_type: isVideo ? "video" : "photo",
            video_embed_url: isVideo ? `${permalink.replace(/\/$/, "")}/embed` : null,
            like_count: post.like_count ?? null,
            comment_count: post.comments_count ?? null,
        };
    });
    await upsertPosts(rows);
}

async function getTikTokAccessToken(): Promise<string | null> {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    if (!clientKey || !clientSecret) return null;

    const { data: tokenRow } = await supabase
        .from("platform_tokens")
        .select("refresh_token")
        .eq("platform", "tiktok")
        .maybeSingle();
    if (!tokenRow) {
        console.error("tiktok: aucun refresh_token enregistré, voir tiktok-oauth-callback");
        return null;
    }

    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: tokenRow.refresh_token,
        }),
    });
    const data = await res.json();
    if (!data.access_token) {
        console.error("tiktok token error:", data);
        return null;
    }

    // TikTok fait tourner le refresh token à chaque utilisation.
    await supabase.from("platform_tokens").upsert({
        platform: "tiktok",
        refresh_token: data.refresh_token,
        updated_at: new Date().toISOString(),
    });

    return data.access_token;
}

async function syncTikTok() {
    const accessToken = await getTikTokAccessToken();
    if (!accessToken) return;

    const res = await fetch(
        "https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ max_count: 10 }),
        }
    );
    const data = await res.json();
    const videos = data.data?.videos || [];
    if (data.error && data.error.code !== "ok") {
        console.error("tiktok video.list error:", data.error);
    }

    const rows: SocialPost[] = videos.map((video: any) => ({
        platform: "tiktok",
        external_id: video.id,
        title: sanitizeText(video.title),
        body: null,
        media_url: null,
        thumbnail_url: video.cover_image_url || null,
        permalink: video.share_url,
        published_at: new Date(video.create_time * 1000).toISOString(),
        media_type: "video",
        video_embed_url: `https://www.tiktok.com/embed/v2/${video.id}`,
        like_count: video.like_count ?? null,
        comment_count: video.comment_count ?? null,
    }));
    await upsertPosts(rows);
}

Deno.serve(async (_req) => {
    const results = await Promise.allSettled([
        syncYouTube(),
        syncFacebook(),
        syncInstagram(),
        syncTikTok(),
    ]);

    const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => String(r.reason));

    return new Response(
        JSON.stringify({ ok: errors.length === 0, errors }),
        { headers: { "Content-Type": "application/json" } }
    );
});
