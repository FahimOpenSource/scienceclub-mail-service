

interface EmailMessage {
    readonly from: string;
    readonly to: string;
}

export interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    MASTER_GMAIL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GMAIL_REFRESH_TOKEN: string;
}


interface ForwardableEmailMessage<Body = unknown> {
    readonly from: string;
    readonly to: string;
    readonly headers: Headers;
    readonly raw: ReadableStream;
    readonly rawSize: number;

    setReject(reason: string): void;
    forward(rcptTo: string, headers?: Headers): Promise<void>;
    reply(message: EmailMessage): Promise<void>;
}

async function redirectToOAuth(env: Env): Promise<Response> {
    const oAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
    ];
    const state = crypto.randomUUID(); // Generate a random state parameter for CSRF protection
    const redirectUri = "https://email-worker.scienceclublss.me/google/callback";

    oAuthUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    oAuthUrl.searchParams.set("response_type", "code");
    oAuthUrl.searchParams.set("scope", scopes.join(" "));
    oAuthUrl.searchParams.set("redirect_uri", redirectUri);
    oAuthUrl.searchParams.set("access_type", "offline");
    oAuthUrl.searchParams.set("state", state);
    console.log("Redirecting to Google OAuth URL:", oAuthUrl.toString());
    return new Response(null, {
        status: 302,
        headers: {
            Location: oAuthUrl.toString(),
            "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
});
}


async function getGoogleAccessToken(env: Env, code: string | null, refreshToken: string | null): Promise<string> {

    // the code is provuided intially when connecting to new master google account then refresh token is used to get new access tokens programatically
    // user refresh token is logged during initial setup and must added to env.variables 
    const url = new URL("https://oauth2.googleapis.com/token");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("client_secret", env.GOOGLE_CLIENT_SECRET);
    url.searchParams.set("redirect_uri", "https://email-worker.scienceclublss.me/google/callback");
    url.searchParams.set("grant_type", refreshToken ? "refresh_token" : "authorization_code");
    if (refreshToken) {
        url.searchParams.set("refresh_token", refreshToken);
    } if (code) {
        url.searchParams.set("code", code);
    } else if (!code && !refreshToken) {
        return Promise.reject(new Error("No authorization code or refresh token provided"));
    }
    const response = await fetch(
        url.toString(),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        },
    );

    const data: { access_token?: string; expires_in?: number; token_type?: string; scope?: string; refresh_token?: string; error?: string; error_description?: string } = await response.json();
    console.log('---------',data)
    if (data.error || !data.access_token) {
        return Promise.reject(
            new Error(
                `Error fetching access token: ${data.error_description || data.error}`,
            ),
        );
    } 

    console.log("Received refresh token from Google:", data.refresh_token);

    return data.access_token;
}


function getCookie(request: Request, name: string) {
    // gets the value of a cookie by name from the request heades
    const cookieHeader = request.headers.get("Cookie") ?? "";
    return cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))
        ?.split("=")[1];
}

async function handleInitialSetup(
    request: Request,
    env: Env,
): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const savedState = getCookie(request, "oauth_state");
    const error = url.searchParams.get("error");

    console.log(code);

    if (!returnedState || !savedState || returnedState !== savedState) {
        return new Response("Invalid OAuth state", { status: 400 });
    }
    if (error == "access_denied") {
        return new Response("Access denied by user", { status: 403 });
    }
    if (code) {
        try {
            const accessToken = await getGoogleAccessToken(env, code, null);
        } catch (err) {
            console.error("Error handling Google OAuth callback:", err);
            return new Response("Failed to obtain access token", {
                status: 500,
            });
        }
    } else {
        return new Response("Code not received", { status: 400 });
    }

    return new Response("Successfully connected to Gmail", { status: 200 });
}


export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url)

        if (url.pathname === "/connect-gmail") {
            // This endpoint is used to initiate the Google OAuth flow. It redirects the user to Google's authorization page.
            return redirectToOAuth(env)
        }

        if (url.pathname === "/google/callback") {
            if (env.GMAIL_REFRESH_TOKEN === "") {
                // No refresh token is available, so we need to handle the OAuth callback to get one. This will happen on the first connection.
                // This endpoint is the callback URL that Google redirects to after the user authorizes the app. It handles the OAuth callback and exchanges the authorization code for an access token.
                return handleInitialSetup(request, env);
            }
            return new Response("Gmail account already connected.", { status: 200 });
            
        }

        return new Response("Not found", { status: 404 })
    },


    async email(message: ForwardableEmailMessage, env: Env) {

        const fromAddress = message.from;
        const toAddress = message.to;     
        
        

        await message.forward(env.MASTER_GMAIL);


    },
};
