import { DurableObject } from "cloudflare:workers";

export interface GmailMessagePartBody {
    attachmentId: string;
    size: number;
    data: string;
}

export interface GmailMessagePart {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    body: GmailMessagePartBody;
    parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: [string];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
  error?: {}
}

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
  ENV_MODE: "development" | "production";
  REDIRECT_URI: string;
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

// type WorkerWithEmail = ExportedHandler<Env> & {
//     email?: (
//         message: ForwardableEmailMessage,
//         env: Env,
//         ctx: ExecutionContext,
//     ) => void | Promise<void>;
// };

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
  async setAccessToken(token: string, expiresIn: number) {
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
    return token !== undefined ? String(token) : null;
  }

  async removeRefreshToken(): Promise<void> {
    await this.ctx.storage.delete("refresh_token");
    await this.ctx.storage.delete("refresh_token_expires_in");
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

    data.access_token && data.expires_in
      ? await this.setAccessToken(data.access_token, data.expires_in)
      : null;
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
      : console.log("Alarm error: Refresh token not found");
    console.log("Access token refreshed successfully");
  }
}

async function redirectToOAuth(env: Env): Promise<Response> {
  const oAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
  const state = crypto.randomUUID(); // Generate a random state parameter for CSRF protection
  // const redirectUri = "https://email-worker.scienceclublss.me/google/callback";

  oAuthUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  oAuthUrl.searchParams.set("response_type", "code");
  oAuthUrl.searchParams.set("scope", scopes.join(" "));
  oAuthUrl.searchParams.set("redirect_uri", env.REDIRECT_URI);
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

async function getGoogleAccessToken(
  env: Env,
  code: string,
  tokenManager: DurableObjectStub<GoogleOAuthManager>,
): Promise<any> {
  const url = new URL("https://oauth2.googleapis.com/token");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("client_secret", env.GOOGLE_CLIENT_SECRET);
  url.searchParams.set("redirect_uri", env.REDIRECT_URI);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("code", code);

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
    refresh_token?: string;
    refresh_token_expires_in?: number;
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

  // now we have the access token and the refresh token
  data.refresh_token && data.refresh_token_expires_in
    ? await tokenManager.setRefreshToken(
        data.refresh_token,
        data.refresh_token_expires_in,
      )
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
  tokenManager: DurableObjectStub<GoogleOAuthManager>,
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
      await getGoogleAccessToken(env, code, tokenManager);
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
function extractClassAndStream(
  email: string,
): { class: string; stream: string } | null {
  const match = /^senior(\d+)([a-zA-Z])@/.exec(email);
  if (!match) return null;
  return { class: match[1], stream: match[2] };
}

function getTokenManager(env: Env): DurableObjectStub<GoogleOAuthManager> {
  return env.GOOGLE_OAUTH_MANAGER.getByName("main");
}

async function forwardMessageToGmail(
  message: any,
  env: Env,
  tokenManager: DurableObjectStub<GoogleOAuthManager>,
): Promise<{ messageId: string } | null> {
  // returns the ids of the forwarded message in the master inbox.
  const messageID = message.headers.get("Message-ID");
  const accessToken = await tokenManager.getAccessToken();
  await message.forward(env.MASTER_GMAIL);

  await new Promise((resolve) => setTimeout(resolve, 5000)); // waiting for forwarded message to be processed
  const listMessagesUrl = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages`,
  );
  listMessagesUrl.searchParams.set("q", `rfc822msgid:${messageID} `);

  const reponse = await fetch(listMessagesUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const messagesList: {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate: Number;
  } = JSON.parse(await reponse.text());
  if (messagesList.resultSizeEstimate !== 0 && messagesList.messages) {
    const messageId = messagesList.messages[0].id;
    return { messageId };
  }
  return null;
}

async function getGmailMessageById(
  messageId: string,
  tokenManager: DurableObjectStub<GoogleOAuthManager>,
): Promise<GmailMessage> {
  const accessToken = await tokenManager.getAccessToken();
  const getMessageUrl = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}
`,
  );
  getMessageUrl.searchParams.set("format", "full");

  const response = await fetch(getMessageUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const gmailMessage: GmailMessage = await response.json();
  return gmailMessage;
}

async function saveMetaDataToSupabase(
  gmailMessage: GmailMessage,
  env: Env,
  user_id: string,
  receiver: string,
  sender: string,
) {
  const snippet = gmailMessage.snippet;
  const messageId = gmailMessage.id;
  const messageThreadId = gmailMessage.threadId;
  const receivedAt = new Date(Number(gmailMessage.internalDate)).toISOString();
  const payload = gmailMessage.payload;
  const hasAttachments =
    payload.mimeType !== "multipart/alternative" ? true : false;
  const subject = payload.headers.find(
    (header) => header.name === "Subject",
  )?.value;
  const fromName = payload.headers.find(
    (header) => header.name === "From",
  )?.value;
  const labelIds = gmailMessage.labelIds;

  if (await isMessageSaved(messageId, env, receiver)) {
    console.log("Message with id", messageId, "already exists in database.");
    return;
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_messages`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
    body: JSON.stringify({
      recipient_email: receiver,
      from_email: sender,
      snippet: snippet,
      gmail_message_id: messageId,
      gmail_thread_id: messageThreadId,
      received_at: receivedAt,
      assigned_user_id: user_id,
      subject: subject,
      from_name: fromName,
      has_attachments: hasAttachments,
      labelids: labelIds,
    }),
  });
  if (response.status !== 201 || !response.ok) {
    console.error("Failed to save email metadata to Supabase", {
      status: response.status,
      body: await response.text(),
    });
    return;
  } else {
    console.log("Email sent and saved successfully", await response.text());
    return;
  }
}

function checkForAttachments (topLevelPart: GmailMessagePart) {
  var attachments = []
   if (topLevelPart.mimeType === "multipart/mixed") {
       if (topLevelPart.parts) {
           for (var messagePart of topLevelPart.parts) {
               if (messagePart.mimeType !== "multipart/alternative") {
                   const attachmentId = messagePart.body.attachmentId;
                   const fileName = messagePart.filename;
                   const size = messagePart.body.size;
                   const mimeType = messagePart.mimeType;
                   attachments.push({
                       attachmentId,
                       fileName,
                       size,
                       mimeType,
                   });
               }
           }
       }
   }
   return attachments;
}

export async function GetAttachmentData(
    accessToken: string,
    messageId: string,
    attachmentId: string,
): Promise<GmailMessagePartBody | null> {
    const getMessageUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    );

    const response = await fetch(getMessageUrl.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        console.log(`Error fetching attachement,${await response.json()}`);
        return null;
    }
    const attachment: GmailMessagePartBody = await response.json();
    attachment.attachmentId = attachmentId;
    return attachment;
}

async function SaveAttachments( message: GmailMessage,tokenManager: DurableObjectStub<GoogleOAuthManager>, env:Env) {
  const messageId = message.id
  const accessToken = await tokenManager.getAccessToken();
  const attachments = checkForAttachments(message.payload)
  if (attachments.length !== 0) {
    for(var attachment of attachments) {
      if (accessToken) {
        const attachmentData = await GetAttachmentData(
            accessToken,
            messageId,
            attachment.attachmentId,
        );
        if (attachmentData) {
          const data = gmailBase64UrlToBytes(attachmentData.data);
          const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/email-attachments/${messageId}/${attachment.fileName}`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
            "Content-Type": attachment.mimeType,
            "x-upsert": "true",
             }, body: data
          })
          const body = await response.json();
          if (!response.ok) {
            console.error('storage error', body)
          } 
          console.log('storage response', body)
      } if (!attachmentData) {
        console.error('access token missing')
      }
    }
    }
  }
}
async function isMessageSaved(
  gmailMessageId: string,
  env: Env,
  receiver: string,
): Promise<boolean> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_messages?gmail_message_id=eq.${gmailMessageId}&recipient_email=eq.${receiver}`,
    {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    },
  );
  const messages: {}[] = await response.json();
  return messages.length === 0 ? false : true;
}

async function confirmHasUserAccount(
  env: Env,
  receiver: string,
): Promise<{ has_account: boolean; user_id: string | null }> {
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
  const { has_account, user_id, is_confirmed, has_profile } = json[0] ?? {
    has_account: false,
    user_id: null,
    is_confirmed: false,
    has_profile: false,
  };
  if (!response.ok) {
    return Promise.reject(
      new Error(`Supabase RPC error: ${response.statusText}`),
    );
  }

  return { has_account, user_id };
}

function gmailBase64UrlToBytes(data:string) {
    let base64 = data.replace(/-/g, "+").replace(/_/g, "/");

    while (base64.length % 4) {
        base64 += "=";
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

async function sendGroupEmails(
  message: any,
  env: Env,
  klass: string,
  stream: string,
) {
  const rpcApiUrl = new URL(
    `${env.SUPABASE_URL}/rest/v1/rpc/get_class_stream_user_emails`,
  );
  const response = await fetch(rpcApiUrl.toString(), {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
    body: JSON.stringify({ class_name: klass, stream_name: stream }),
  });

  const groupEmails = (await response.json()) as Array<{
    class_stream_exists: boolean;
    emails: { string: string };
  }>;
  if (!response.ok || !groupEmails[0].class_stream_exists) {
    console.error(
      "Failed to retrieve group emails or class/stream does not exist",
    );
    return;
  }
  const sender = message.from;
  const tokenManager = getTokenManager(env);
  const gmailMessageId = await forwardMessageToGmail(
    message,
    env,
    tokenManager,
  );
  const gmailMessage = gmailMessageId
    ? await getGmailMessageById(gmailMessageId.messageId, tokenManager)
    : console.error("Forwarded message not found in Gmail inbox");

  if (gmailMessage) {
    await Promise.all(
      Object.entries(groupEmails[0].emails).map(
        async ([receiver, userId]): Promise<null> => {
          await saveMetaDataToSupabase(
            gmailMessage,
            env,
            userId,
            receiver,
            sender,
          );
          console.log("Group msg sent to: ", receiver);
          return null;
        },
      ),
    );
    await SaveAttachments(gmailMessage, tokenManager, env)
    console.log("All group messages sent successfully");
    return;
  }
  return;
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

    if (url.pathname === "/remove-refresh-token") {
      // previous access token should be cleared from state/ storage first before "/connect-gmail" is called again.
      const tokenManager = getTokenManager(env);
      await tokenManager.removeRefreshToken();
      return new Response("Refresh token removed.", {
        status: 200,
      });
    }

    if (url.pathname === "/google/callback") {
      const tokenManager = getTokenManager(env);
      const refreshToken = await tokenManager.getRefreshToken();
      console.log(
        "Received request to /google/callback, refresh token in storage:",
        refreshToken,
      );
      if (refreshToken === null) {
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

  async email(message, env: Env, ctx: ExecutionContext) {
    const receiver = message.to;
    // first check if receiver's address is for a single user or group ie stream/class

    const classStream = extractClassAndStream(receiver);
    if (!classStream) {
      // the receiver's address is not a group address such as senior5p@scienceclublss.me

      const { has_account, user_id } = await confirmHasUserAccount(
        env,
        receiver,
      ).catch((error) => {
        console.error("Error confirming user account:", error);
        return { has_account: false, user_id: null };
      });

      if (!has_account) {
        console.log(receiver, "does not have an account.");
        return;
      }

      if (has_account && user_id) {
        // receiver has account
        const sender = message.from;
        const tokenManager = getTokenManager(env);
        const gmailMessageId = await forwardMessageToGmail(
          message,
          env,
          tokenManager,
        );
        const gmailMessage = gmailMessageId
          ? await getGmailMessageById(gmailMessageId.messageId, tokenManager)
          : console.error("Forwarded message not found in Gmail inbox");
        if (gmailMessage) {
          await saveMetaDataToSupabase(
              gmailMessage,
              env,
              user_id,
              receiver,
              sender,
            )
            await SaveAttachments(gmailMessage, tokenManager,env)

        }
        return;
      }

      // doesn't have account
      console.log(receiver, " doesnt have account");

      return;
    }
    // emails is a group address
    await sendGroupEmails(message, env, classStream.class, classStream.stream);
    return;
  },
} satisfies ExportedHandler<Env>;
