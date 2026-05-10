import { DurableObject } from "cloudflare:workers";



interface EmailMessage {
    readonly from: string;
    readonly to: string;
}

export interface Env {
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
    MASTER_GMAIL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_OAUTH_MANAGER: DurableObjectNamespace<GoogleOAuthManager>;
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

type WorkerWithEmail = ExportedHandler<Env> & {
    email?: (
        message: ForwardableEmailMessage,
        env: Env,
        ctx: ExecutionContext,
    ) => void | Promise<void>;
};

    /**
     * This Durable Object manages persistance of tjhe access tocken across different worker instances.
     * It also refreshes the access token on when it expires using the refresh token. 
     * 
     * Tthe the refresh token is saved to SQL storage after inital Authorization.
     * Access tokens are got through the get method.
     */
export class GoogleOAuthManager extends DurableObject<Env> {
    private accessTokenExparation: number;
    private envVariables: Env;
    
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.accessTokenExparation = 0;
        this.envVariables = env;
    }

    async setRefreshToken(token: string, expiresIn: number): Promise<void> {
        await this.ctx.storage.put("refresh_token", token);
        await this.ctx.storage.put("refresh_token_expires_in", expiresIn);
    }
    async setAccessToken(
        token: string,
        expiresIn: number,
    ) {
        await this.ctx.storage.put("access_token", token);
        await this.ctx.storage.put("access_token_expires_in", expiresIn);
        this.accessTokenExparation = Date.now() + expiresIn * 1000;
        this.ctx.storage.setAlarm(this.accessTokenExparation);
    }

    async getRefreshToken(): Promise<string | null> {
        const token = await this.ctx.storage.get("refresh_token");
        return token !== undefined ? String(token) : null;
    }

    async getAccessToken(): Promise<string | null> {
        const token = await this.ctx.storage.get("access_token");
        return token !== undefined ? String(token): null;
    }

    async refreshAccessToken(refreshToken: string): Promise<void> {
        const env = this.envVariables;
        const url = new URL("https://oauth2.googleapis.com/token");
        url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
        url.searchParams.set("client_secret", env.GOOGLE_CLIENT_SECRET);
        url.searchParams.set("grant_type", "refresh_token");
        url.searchParams.set("refresh_token", refreshToken);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const data: {
            access_token?: string;
            expires_in?: number;
            token_type?: string;
            scope?: string;
            error?: string;
            error_description?: string;
        } = await response.json();
        if (data.error || !data.access_token) {
            return Promise.reject(
                new Error(
                    `Error fetching access token: ${data.error_description || data.error}`,
                ),
            );
        } 

        data.access_token && data.expires_in ? await this.setAccessToken(data.access_token, data.expires_in) : null;
    }

    async alarm(alarmInfo: AlarmInvocationInfo): Promise<void> {
        // this runs when the expiry date of the access token is reached.

        if (alarmInfo.isRetry) {
            // Incase there was an error in the last refresh attempt.
            // It is likey the refresh token has expired or is invaliid
            // Here the admin need to repeat the OAuth process for authorization inorder to obtain 
            console.error("Failed to refresh access token after retrying", {
                retryCount: alarmInfo.retryCount,
            });
            return;
        }


        const refreshToken = await this.getRefreshToken();
        refreshToken
            ? await this.refreshAccessToken(refreshToken)
            : console.log("Alarm error: Refresh token not found");;
        console.log("Access token refreshed successfully");

    }
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

/**
 * This function receivees the authorization code from Google and exchanges it for an access token.
 * The code is provided initially when connecting to a new master Google account, and the refresh token is used to get new access tokens programatically.
 * The user's refresh token is logged during initial setup and must be added to env.variables.
 * 
 * The refresh token is used if code is not provided, which happens during normal operation after the initial setup, to get a new access token without user interaction.
 */
// 

async function getGoogleAccessToken(env: Env, code: string, tokenManager: DurableObjectStub<GoogleOAuthManager>): Promise<any> {

    const url = new URL("https://oauth2.googleapis.com/token");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("client_secret", env.GOOGLE_CLIENT_SECRET);
    url.searchParams.set("redirect_uri", "https://email-worker.scienceclublss.me/google/callback");
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("code", code);
    
    const response = await fetch(
        url.toString(),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        },
    );

    const data: { access_token?: string; expires_in?: number; token_type?: string; scope?: string; refresh_token?: string; refresh_token_expires_in?: number; error?: string; error_description?: string } = await response.json();
    if (data.error || !data.access_token) {
        return Promise.reject(
            new Error(
                `Error fetching access token: ${data.error_description || data.error}`,
            ),
        );
    } 

    // now we have the access token and the refresh token
    data.refresh_token && data.refresh_token_expires_in
        ? await tokenManager.setRefreshToken(data.refresh_token, data.refresh_token_expires_in)
        : null;
    data.access_token && data.expires_in
        ? await tokenManager.setAccessToken(data.access_token, data.expires_in)
        : null;
   

    console.log("Received refresh token from Google:", data.refresh_token);

    return data;
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
    tokenManager: DurableObjectStub<GoogleOAuthManager>
): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const savedState = getCookie(request, "oauth_state");
    const error = url.searchParams.get("error");

    if (!returnedState || !savedState || returnedState !== savedState) {
        return new Response("Invalid OAuth state", { status: 400 });
    }
    if (error == "access_denied") {
        return new Response("Access denied by user", { status: 403 });
    }
    if (code) {
        try {
            await getGoogleAccessToken(
                env,
                code,
                tokenManager,
            );
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


/**
 * Extracts class and stream from an email like "senior5p@scienceclublss.me".
 * Returns { class: string, stream: string } or null if not matching.
 */
function extractClassAndStream(email: string): { class: string, stream: string } | null {
  const match = /^senior(\d+)([a-zA-Z])@/.exec(email);
  if (!match) return null;
  return { class: match[1], stream: match[2] };
}

function getTokenManager(env: Env): DurableObjectStub<GoogleOAuthManager> {
    return env.GOOGLE_OAUTH_MANAGER.getByName("main");
}


export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        if (url.pathname === "/access-token" && request.method === "GET") {
            // Handle access token request
            const tokenManager = getTokenManager(env);
            const accessToken = await tokenManager.getAccessToken();
            return new Response(JSON.stringify({ access_token: accessToken }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (url.pathname === "/connect-gmail") {
            // This endpoint is used to initiate the Google OAuth flow. It redirects the user to Google's authorization page.
            return redirectToOAuth(env);
        }

        if (url.pathname === "/google/callback") {
            const tokenManager = getTokenManager(env);
            const refreshToken = await tokenManager.getRefreshToken() ;
            console.log("Received request to /google/callback, refresh token in storage:", refreshToken);
            if (refreshToken === null ) {
                console.log("No refresh token found, handling initial setup");
                // No refresh token is available, so we need to handle the OAuth callback to get one. This will happen on the first connection during authorization step.
                // This endpoint is the callback URL that Google redirects to after the user authorizes the app. It handles the OAuth callback and exchanges the authorization code for an access token.
                return handleInitialSetup(request, env, tokenManager);
            }
            return new Response("Gmail account already connected.", {
                status: 200,
            });
        }

        return new Response("Not found", { status: 404 });
    },

    async email(message, env: Env) {
        const receiver = message.to;

        // first check if receiver's address is for a single user or group ie stream/class

        const classStream = extractClassAndStream(receiver);
        if (!classStream) {
            // the receiver's address is not a group address such as senior5p@scienceclublss.me
            console.log("confirming user");

            const rpcApiUrl = new URL(
                `${env.SUPABASE_URL}/rest/v1/rpc/email_has_account`,
            );
            const response = await fetch(rpcApiUrl.toString(), {
                method: "POST",
                headers: {
                    apikey: env.SUPABASE_SECRET_KEY,
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
                },
                body: JSON.stringify({ email_address: receiver }),
            });

            const json = (await response.json()) as Array<{
                has_account: boolean;
                user_id: string | null;
                is_confirmed: boolean;
                has_profile: boolean;
            }>;
            const { has_account, user_id, is_confirmed, has_profile } =
                json[0] ?? {
                    has_account: false,
                    user_id: null,
                    is_confirmed: false,
                    has_profile: false,
                };
            if (!response.ok) {
                console.error(
                    "Error checking email in Supabase:",
                    response.statusText,
                );
                return;
            } else {
                if (has_account) {
                    // receiver has account

                    const metadata = {
                        sender: message.from,
                        subject: message.headers.get("Subject"),
                        message_id: message.headers.get("Message-ID"),
                        date_header: message.headers.get("Date"),
                    };

                    const response = await fetch(
                        `${env.SUPABASE_URL}/rest/v1/rpc/email_has_account`,
                        {
                            method: "POST",
                            headers: {
                                apikey: env.SUPABASE_SECRET_KEY,
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
                            },
                            body: JSON.stringify({ email_address: receiver }),
                        },
                    );
                } else {
                    // doesn't have account
                }
            }

            console.log();

            // check if a user exists with the receiver's email address.

            return;
        } else {
            return;
        }

        await message.forward(env.MASTER_GMAIL);
    },
} satisfies WorkerWithEmail;

