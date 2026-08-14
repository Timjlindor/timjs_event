// =============================================================================
// Envoi des notifications push — appelé après la publication du reel du jour.
// Lit les abonnés dans Supabase (push_subscriptions) et envoie une notification
// à chacun via web-push (clés VAPID). Les abonnements expirés sont supprimés.
//
// Secrets attendus (GitHub Actions) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (optionnel, ex. mailto:lindorelie23@gmail.com)
// Si une clé manque, le script se termine sans erreur (rien à envoyer).
// =============================================================================

import webpush from "web-push";

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = env.VAPID_PUBLIC_KEY;
const PRIV = env.VAPID_PRIVATE_KEY;
const SUBJECT = env.VAPID_SUBJECT || "mailto:lindorelie23@gmail.com";
const SITE = env.SITE_BASE_URL || "https://timjs-event.vercel.app";

const log = (...a) => console.log("•", ...a);

if (!SUPABASE_URL || !KEY || !PUB || !PRIV) {
    log("Notifications push non configurées (clés manquantes) — rien à envoyer.");
    process.exit(0);
}

webpush.setVapidDetails(SUBJECT, PUB, PRIV);

async function main() {
    const subs = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,subscription`,
        { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    ).then((r) => r.json());

    if (!Array.isArray(subs) || subs.length === 0) {
        log("Aucun abonné pour le moment.");
        return;
    }
    log(`${subs.length} abonné(s). Envoi des notifications…`);

    const payload = JSON.stringify({
        title: "🎬 Reel du jour — Timj Multi-Services",
        body: "On sublime vos plus beaux moments ✨ Découvre le reel d'aujourd'hui !",
        url: SITE + "/",
        icon: "/Timjs.PNG"
    });

    let ok = 0, gone = 0, fail = 0;
    for (const row of subs) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            ok++;
        } catch (e) {
            // 404/410 = abonnement expiré → on le supprime
            if (e.statusCode === 404 || e.statusCode === 410) {
                gone++;
                await fetch(
                    `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`,
                    { method: "DELETE", headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
                ).catch(() => {});
            } else {
                fail++;
            }
        }
    }
    log(`✅ Envoyées : ${ok} · expirées supprimées : ${gone} · échecs : ${fail}`);
}

main().catch((e) => { console.error("ÉCHEC push :", e); process.exit(0); });
