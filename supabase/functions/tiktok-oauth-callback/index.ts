// Callback OAuth TikTok — à utiliser UNE SEULE FOIS pour connecter le
// compte TikTok. Voir CONFIGURATION-SUPABASE.md pour le lien
// d'autorisation à ouvrir dans le navigateur.
//
// TikTok redirige ici avec un ?code=..., qu'on échange contre un
// refresh_token stocké dans public.platform_tokens. La fonction
// sync-social-posts s'en sert ensuite pour lire les vidéos, et fait
// tourner ce refresh_token à chaque appel.
//
// Secrets attendus : TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI
// (TIKTOK_REDIRECT_URI doit être EXACTEMENT l'URL de cette fonction, et
// doit être enregistrée telle quelle dans l'app TikTok for Developers).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
        return new Response(`TikTok a refusé l'autorisation : ${error}`, { status: 400 });
    }
    if (!code) {
        return new Response("Paramètre 'code' manquant dans l'URL.", { status: 400 });
    }

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!;
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("TIKTOK_REDIRECT_URI")!;

    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        }),
    });
    const data = await res.json();

    if (!data.refresh_token) {
        return new Response(
            "Échec de l'échange du code TikTok : " + JSON.stringify(data),
            { status: 400 }
        );
    }

    const { error: dbError } = await supabase.from("platform_tokens").upsert({
        platform: "tiktok",
        refresh_token: data.refresh_token,
        updated_at: new Date().toISOString(),
    });

    if (dbError) {
        return new Response("Token reçu mais échec de l'enregistrement : " + dbError.message, { status: 500 });
    }

    return new Response(
        "TikTok connecté avec succès. Tu peux fermer cette page — la synchronisation automatique est prête.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
});
