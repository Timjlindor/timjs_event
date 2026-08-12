// =============================================================================
// Reel quotidien automatique — Timj Multi-Services
// -----------------------------------------------------------------------------
// Chaque jour (déclenché à 7h par .github/workflows/daily-reel.yml) ce script :
//   1. choisit une photo du dossier Photographie/ (rotation quotidienne) ;
//   2. la transforme en un mini-reel vidéo vertical (ffmpeg, effet de zoom) ;
//   3. génère une légende + des hashtags optimisés selon le style de la photo ;
//   4. héberge la vidéo (Supabase Storage) et publie une annonce sur le site ;
//   5. publie le reel sur les réseaux CONFIGURÉS (Instagram, Facebook, TikTok,
//      YouTube). Un réseau dont les secrets manquent est simplement ignoré.
//
// AUCUN identifiant n'est écrit ici : tout vient des "Secrets" GitHub
// (Settings → Secrets and variables → Actions). Voir AUTOMATION-RESEAUX.md.
// =============================================================================

import { readdirSync, statSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const env = process.env;
const SITE_BASE_URL = env.SITE_BASE_URL || "https://timjlindor.github.io/timjs_event";
const PHOTO_ROOT = "Photographie";
const OUT_VIDEO = "reel.mp4";
const AUDIO_PATH = env.AUDIO_PATH || "audio/timj-reels-instrumental.mp3";
const FPS = 30;

// --- Petit utilitaire de log lisible dans les logs GitHub Actions -------------
const log = (...a) => console.log("•", ...a);
const warn = (...a) => console.warn("⚠", ...a);

// =============================================================================
// 1. Choisir la photo du jour (rotation déterministe)
// =============================================================================
// Sous-dossiers = catégories (Bapteme, Photo Mariage, Photo Studio, …).
function listCategoryDirs(root) {
    return readdirSync(root)
        .map((n) => join(root, n))
        .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
        .sort();
}

function photosIn(dir) {
    return readdirSync(dir)
        .filter((n) => !n.startsWith(".") && /\.(jpe?g|png)$/i.test(n))
        .sort()
        .map((n) => join(dir, n));
}

// UNE photo par catégorie (rotation quotidienne), 6 au total.
function pickOnePerCategory(root) {
    const day = Math.floor(Date.now() / 86_400_000);
    const picks = [];
    for (const dir of listCategoryDirs(root)) {
        const ph = photosIn(dir);
        if (ph.length) picks.push(ph[day % ph.length]);
    }
    return picks.slice(0, 6);
}

// Déduit le style à partir du dossier, pour des hashtags pertinents.
function categoryOf(path) {
    const p = path.toLowerCase();
    if (p.includes("mariage")) return "mariage";
    if (p.includes("studio")) return "studio";
    if (p.includes("plein air")) return "plein-air";
    if (p.includes("evennement") || p.includes("evenement")) return "evenementiel";
    if (p.includes("bapteme") || p.includes("baptême")) return "bapteme";
    if (p.includes("graduation")) return "graduation";
    return "photo";
}

// =============================================================================
// 2. Légende + hashtags optimisés (visibilité)
// =============================================================================
const HASHTAGS = {
    commun: [
        "#timjmultiservices", "#timjsphotography", "#haiti", "#ayiti",
        "#photographehaiti", "#haitianphotographer", "#portauprince",
        "#photooftheday", "#instagood", "#reels", "#reelsinstagram",
        "#explore", "#viral",
    ],
    mariage: ["#mariage", "#wedding", "#weddinghaiti", "#mariagehaiti", "#weddingphotography", "#bride", "#justmarried", "#lovestory"],
    studio: ["#studio", "#studiophotography", "#portrait", "#portraitphotography", "#headshot", "#studioportrait", "#beauty"],
    "plein-air": ["#pleinair", "#outdoorphotography", "#naturallight", "#lifestylephotography", "#outdoorportrait", "#goldenhour"],
    evenementiel: ["#evenementiel", "#eventphotography", "#event", "#fete", "#celebration", "#party", "#eventhaiti"],
    bapteme: ["#bapteme", "#baptism", "#christening", "#famille", "#family", "#baby", "#godparents"],
    graduation: ["#graduation", "#grad", "#diplome", "#classof2026", "#success", "#proud"],
    photo: ["#photography", "#photographer", "#photoshoot", "#pictureoftheday"],
};

const LEGENDES = {
    mariage: "💍 On raconte votre plus belle journée en images.",
    studio: "📸 Portraits nets et stylisés, réalisés en studio.",
    "plein-air": "🌳 La lumière naturelle qui sublime chaque instant.",
    evenementiel: "🎉 Chaque moment fort de votre événement, immortalisé.",
    bapteme: "🕊️ Des souvenirs précieux pour un jour unique.",
    graduation: "🎓 Célébrons votre réussite en images.",
    photo: "📷 Capturons ensemble vos plus beaux moments.",
};

function buildCaption(categories) {
    const tags = [];
    for (const c of categories) tags.push(...(HASHTAGS[c] || []));
    tags.push(...HASHTAGS.commun);
    // Dédoublonne, puis limite à 30 (plafond Instagram).
    const uniq = [...new Set(tags)].slice(0, 30);
    const intro = "✨ Décoration · Photographie · Événementiel — on sublime vos plus beaux moments.";
    const cta = "\n\n📅 Réservez votre séance : " + SITE_BASE_URL + "/reservation.html" +
        "\n📞 WhatsApp : +509 31 64 28 17";
    return `${intro}${cta}\n\n${uniq.join(" ")}`;
}

// =============================================================================
// 3. Fabriquer le reel vidéo (ffmpeg) — 6 photos, bande-son, durée = audio
// =============================================================================
function mediaDuration(path) {
    const out = execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path,
    ]).toString().trim();
    return parseFloat(out) || 30;
}

function makeReel(photos, audioPath, outPath) {
    const n = photos.length;
    const dur = mediaDuration(audioPath);          // durée de l'instrumentale
    const seg = dur / n;                            // temps par photo
    const segFrames = Math.max(1, Math.round(seg * FPS));
    log(`Reel : ${n} photos · audio ${dur.toFixed(1)}s → ${seg.toFixed(2)}s/photo`);

    const tmp = mkdtempSync(join(tmpdir(), "reel-"));
    try {
        // 1) Un clip vertical (zoom doux) par photo, tous à la même durée.
        const clips = photos.map((photo, i) => {
            const clip = join(tmp, `seg${i}.mp4`);
            execFileSync("ffmpeg", [
                "-y", "-loop", "1", "-i", photo, "-t", seg.toFixed(3),
                "-vf",
                "scale=3240:5760:force_original_aspect_ratio=increase,crop=3240:5760," +
                `zoompan=z='min(zoom+0.0006,1.15)':d=${segFrames}:s=1080x1920:fps=${FPS},format=yuv420p`,
                "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", String(FPS),
                clip,
            ], { stdio: "inherit" });
            return clip;
        });

        // 2) Assemblage des clips + ajout de l'instrumentale, coupé à la durée de l'audio.
        const listFile = join(tmp, "list.txt");
        writeFileSync(listFile, clips.map((c) => `file '${c}'`).join("\n"));
        execFileSync("ffmpeg", [
            "-y",
            "-f", "concat", "-safe", "0", "-i", listFile,
            "-i", audioPath,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-t", dur.toFixed(3), "-movflags", "+faststart",
            outPath,
        ], { stdio: "inherit" });
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    log("Reel généré :", outPath);
}

// =============================================================================
// 4. Héberger la vidéo sur Supabase Storage (bucket public "reels")
// =============================================================================
async function uploadToSupabase(filePath) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        warn("Supabase non configuré : pas d'hébergement ni de post sur le site.");
        return null;
    }
    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    // Crée le bucket public "reels" si besoin (idempotent).
    await fetch(`${url}/storage/v1/bucket`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: "reels", name: "reels", public: true }),
    }).catch(() => {});

    const fileName = `reel-${new Date().toISOString().slice(0, 10)}.mp4`;
    const bytes = readFileSync(filePath);
    const up = await fetch(`${url}/storage/v1/object/reels/${fileName}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "video/mp4", "x-upsert": "true" },
        body: bytes,
    });
    if (!up.ok) {
        warn("Échec de l'upload Supabase :", up.status, await up.text());
        return null;
    }
    const publicUrl = `${url}/storage/v1/object/public/reels/${fileName}`;
    log("Vidéo hébergée :", publicUrl);
    return publicUrl;
}

// =============================================================================
// 5. Publier une annonce sur le SITE (table annonces)
// =============================================================================
async function postToSite(caption, videoUrl, photoUrl) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const body = {
        author_email: "automation@timj",
        title: "🎬 Reel du jour",
        body: caption + (videoUrl ? `\n\n▶ Vidéo : ${videoUrl}` : "") +
              (photoUrl ? `\n🖼️ Photo : ${photoUrl}` : ""),
    };
    const res = await fetch(`${url}/rest/v1/annonces`, {
        method: "POST",
        headers: {
            apikey: key, Authorization: `Bearer ${key}`,
            "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
    });
    if (res.ok) log("✅ Annonce publiée sur le site.");
    else warn("Échec du post sur le site :", res.status, await res.text());
}

// =============================================================================
// 6. Publier sur les réseaux (chacun ignoré si ses secrets manquent)
// =============================================================================

// --- Instagram Reels (Graph API) : nécessite un compte Business + video_url ---
async function postToInstagram(videoUrl, caption) {
    const igId = env.IG_USER_ID, token = env.META_ACCESS_TOKEN;
    if (!igId || !token || !videoUrl) return;
    log("Instagram : création du conteneur reel…");
    const create = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: token }),
    }).then((r) => r.json());
    if (!create.id) return warn("Instagram : échec création :", JSON.stringify(create));

    // On attend que le conteneur soit prêt (encodage côté Meta).
    for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        const st = await fetch(`https://graph.facebook.com/v21.0/${create.id}?fields=status_code&access_token=${token}`).then((r) => r.json());
        if (st.status_code === "FINISHED") break;
        if (st.status_code === "ERROR") return warn("Instagram : encodage en erreur.");
    }
    const pub = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: create.id, access_token: token }),
    }).then((r) => r.json());
    if (pub.id) log("✅ Publié sur Instagram.");
    else warn("Instagram : échec publication :", JSON.stringify(pub));
}

// --- Facebook Page (vidéo) ----------------------------------------------------
async function postToFacebook(videoUrl, caption) {
    const pageId = env.FB_PAGE_ID, token = env.META_ACCESS_TOKEN;
    if (!pageId || !token || !videoUrl) return;
    log("Facebook : publication de la vidéo…");
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: videoUrl, description: caption, access_token: token }),
    }).then((r) => r.json());
    if (res.id) log("✅ Publié sur Facebook.");
    else warn("Facebook : échec :", JSON.stringify(res));
}

// --- TikTok (Content Posting API, PULL_FROM_URL) ------------------------------
async function postToTikTok(videoUrl, caption) {
    const token = env.TIKTOK_ACCESS_TOKEN;
    if (!token || !videoUrl) return;
    log("TikTok : initialisation de la publication…");
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            post_info: { title: caption.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE" },
            source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
        }),
    }).then((r) => r.json());
    if (res?.data?.publish_id) log("✅ Reel envoyé à TikTok (publish_id " + res.data.publish_id + ").");
    else warn("TikTok : échec :", JSON.stringify(res));
}

// Les jetons YouTube expirent en ~1h. Pour une tâche quotidienne non
// surveillée, on échange un "refresh token" (permanent) contre un jeton frais.
async function getYouTubeToken() {
    if (env.YOUTUBE_REFRESH_TOKEN && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: env.YOUTUBE_CLIENT_ID,
                client_secret: env.YOUTUBE_CLIENT_SECRET,
                refresh_token: env.YOUTUBE_REFRESH_TOKEN,
                grant_type: "refresh_token",
            }),
        }).then((r) => r.json());
        if (res.access_token) return res.access_token;
        warn("YouTube : échec du refresh token :", JSON.stringify(res));
        return null;
    }
    return env.YOUTUBE_ACCESS_TOKEN || null;
}

// --- YouTube (Shorts, upload résumable) ---------------------------------------
async function postToYouTube(filePath, caption, category) {
    const token = await getYouTubeToken();
    if (!token) return;
    log("YouTube : upload du Short…");
    const meta = {
        snippet: { title: (LEGENDES[category] || "Reel Timj") + " #shorts", description: caption, tags: (HASHTAGS[category] || []).map((h) => h.replace("#", "")) },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    };
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": "video/mp4" },
        body: JSON.stringify(meta),
    });
    const uploadUrl = init.headers.get("location");
    if (!uploadUrl) return warn("YouTube : échec init :", init.status, await init.text());
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: readFileSync(filePath) });
    if (put.ok) log("✅ Publié sur YouTube.");
    else warn("YouTube : échec upload :", put.status, await put.text());
}

// =============================================================================
// Orchestration
// =============================================================================
(async () => {
    const photos = pickOnePerCategory(PHOTO_ROOT);
    if (photos.length === 0) throw new Error("Aucune photo trouvée dans " + PHOTO_ROOT);
    const categories = photos.map(categoryOf);
    const caption = buildCaption(categories);
    const photoUrl = `${SITE_BASE_URL}/${encodeURI(photos[0])}`;
    log(`Photos du jour (${photos.length}) :\n  - ` + photos.join("\n  - "));

    makeReel(photos, AUDIO_PATH, OUT_VIDEO);
    const videoUrl = await uploadToSupabase(OUT_VIDEO);

    // Site (toujours, si Supabase configuré)
    await postToSite(caption, videoUrl, photoUrl);

    // Réseaux (chacun sautera tout seul si non configuré). On isole les erreurs
    // pour qu'un réseau en panne ne bloque pas les autres.
    for (const task of [
        () => postToInstagram(videoUrl, caption),
        () => postToFacebook(videoUrl, caption),
        () => postToTikTok(videoUrl, caption),
        () => postToYouTube(OUT_VIDEO, caption, categories[0]),
    ]) {
        try { await task(); } catch (e) { warn("Erreur réseau :", e.message); }
    }

    log("Terminé.");
})().catch((e) => { console.error("ÉCHEC :", e); process.exit(1); });
