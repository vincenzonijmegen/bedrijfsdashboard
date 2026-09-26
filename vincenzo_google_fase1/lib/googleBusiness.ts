import { db } from "@/lib/db";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";

export type GoogleBusinessLocation = {
  accountName: string;
  locationName: string;
  title: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type StoredConnection = {
  refresh_token: string | null;
  access_token: string | null;
  token_expires_at: string | Date | null;
  account_name: string | null;
  location_name: string | null;
};

export function googleBusinessConfigured() {
  return Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim()
  );
}

export function getGoogleBusinessOAuthConfig() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_BUSINESS_CLIENT_ID en/of GOOGLE_BUSINESS_CLIENT_SECRET ontbreken in Vercel."
    );
  }

  return { clientId, clientSecret };
}

export function buildGoogleAuthorizationUrl(redirectUri: string, state: string) {
  const { clientId } = getGoogleBusinessOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getGoogleBusinessOAuthConfig();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google OAuth-token ophalen is mislukt."
    );
  }

  return data;
}

export async function ensureGoogleBusinessTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS google_business_koppeling (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      refresh_token TEXT,
      access_token TEXT,
      token_expires_at TIMESTAMPTZ,
      account_name TEXT,
      location_name TEXT,
      connected_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getStoredGoogleConnection(): Promise<StoredConnection | null> {
  await ensureGoogleBusinessTable();
  const result = await db.query(
    `SELECT refresh_token, access_token, token_expires_at, account_name, location_name
     FROM google_business_koppeling
     WHERE id = 1`
  );
  return (result.rows[0] as StoredConnection | undefined) ?? null;
}

export async function saveGoogleTokens(data: TokenResponse) {
  await ensureGoogleBusinessTable();
  const existing = await getStoredGoogleConnection();
  const refreshToken = data.refresh_token || existing?.refresh_token || null;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + Math.max(0, data.expires_in - 60) * 1000)
    : null;

  await db.query(
    `INSERT INTO google_business_koppeling
       (id, refresh_token, access_token, token_expires_at, connected_at, updated_at)
     VALUES (1, $1, $2, $3, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       access_token = EXCLUDED.access_token,
       token_expires_at = EXCLUDED.token_expires_at,
       connected_at = COALESCE(google_business_koppeling.connected_at, NOW()),
       updated_at = NOW()`,
    [refreshToken, data.access_token || null, expiresAt]
  );

  if (!refreshToken) {
    throw new Error(
      "Google gaf geen refresh-token terug. Trek de koppeling in Google in en koppel opnieuw."
    );
  }
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleBusinessOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google access-token vernieuwen is mislukt."
    );
  }

  await saveGoogleTokens({
    ...data,
    refresh_token: refreshToken,
  });

  return data.access_token;
}

export async function getGoogleAccessToken() {
  const stored = await getStoredGoogleConnection();
  if (!stored?.refresh_token) {
    throw new Error("Google Business Profile is nog niet gekoppeld.");
  }

  const expiresAt = stored.token_expires_at
    ? new Date(stored.token_expires_at).getTime()
    : 0;

  if (stored.access_token && expiresAt > Date.now() + 30_000) {
    return stored.access_token;
  }

  return refreshAccessToken(stored.refresh_token);
}

async function googleFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-GOOG-API-FORMAT-VERSION": "2",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const obj = data as { error?: { message?: string }; message?: string };
    throw new Error(
      obj?.error?.message || obj?.message || `Google API gaf HTTP ${response.status}.`
    );
  }

  return data as Record<string, unknown>;
}

export async function listGoogleBusinessLocations(accessToken: string) {
  const accountsData = await googleFetch(`${ACCOUNT_API}/accounts`, accessToken);
  const accounts = Array.isArray(accountsData.accounts)
    ? (accountsData.accounts as Array<{ name?: string }>)
    : [];

  const locations: GoogleBusinessLocation[] = [];

  for (const account of accounts) {
    if (!account.name) continue;
    const url = new URL(`${BUSINESS_INFO_API}/${account.name}/locations`);
    url.searchParams.set("readMask", "name,title");

    const locationData = await googleFetch(url.toString(), accessToken);
    const rows = Array.isArray(locationData.locations)
      ? (locationData.locations as Array<{ name?: string; title?: string }>)
      : [];

    for (const row of rows) {
      if (!row.name) continue;
      locations.push({
        accountName: account.name,
        locationName: row.name,
        title: row.title || row.name,
      });
    }
  }

  return locations;
}

export async function saveSelectedGoogleLocation(
  accountName: string,
  locationName: string
) {
  await ensureGoogleBusinessTable();
  await db.query(
    `INSERT INTO google_business_koppeling
       (id, account_name, location_name, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       account_name = EXCLUDED.account_name,
       location_name = EXCLUDED.location_name,
       updated_at = NOW()`,
    [accountName, locationName]
  );
}
