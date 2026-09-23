import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabaseClient';

function dbgHosts() {
  const hosts = new Set<string>(['127.0.0.1']);
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri ?? '';
  const lan = String(hostUri).replace(/^exp:\/\//, '').split(':')[0];
  if (lan && lan !== 'exp') hosts.add(lan);
  return Array.from(hosts);
}

function dbg(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  const payload = {
    sessionId: '151e86',
    runId: 'google-oauth-post-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // Metro can see this even when the phone cannot reach the ingest server.
  console.log('[QB-DEBUG]', JSON.stringify(payload));
  // #region agent log
  for (const host of dbgHosts()) {
    fetch(`http://${host}:7843/ingest/1b1f3c78-f59b-4280-a7ed-55237573431c`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '151e86' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
  // #endregion
}

function describeAuthUrl(url: string) {
  try {
    const normalized = url.replace('#', '?');
    const u = new URL(normalized);
    return {
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      paramKeys: Array.from(u.searchParams.keys()),
      hasCode: u.searchParams.has('code'),
      hasAccessToken: u.searchParams.has('access_token'),
      hasRefreshToken: u.searchParams.has('refresh_token'),
      hasError: u.searchParams.has('error'),
      error: u.searchParams.get('error'),
    };
  } catch {
    return { unparseable: true, prefix: url.slice(0, 48) };
  }
}

WebBrowser.maybeCompleteAuthSession();

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() ?? '',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  dbg('B', 'auth.ts:createSessionFromUrl', 'callback parsed', {
    errorCode: errorCode ?? null,
    paramKeys: Object.keys(params),
    hasCode: Boolean(params.code),
    hasAccessToken: Boolean(params.access_token),
    hasRefreshToken: Boolean(params.refresh_token),
    url: describeAuthUrl(url),
  });
  if (errorCode) throw new Error(errorCode);

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    dbg('B', 'auth.ts:createSessionFromUrl', 'exchangeCodeForSession', {
      ok: !error,
      error: error?.message ?? null,
    });
    if (error) throw error;
    return;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token || !refresh_token) {
    dbg('B', 'auth.ts:createSessionFromUrl', 'no code or implicit tokens', {});
    return;
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  dbg('B', 'auth.ts:createSessionFromUrl', 'setSession result', { ok: !error, error: error?.message ?? null });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/');
  const schemeRedirect = makeRedirectUri({ scheme: 'quickbite' });
  dbg('A', 'auth.ts:signInWithGoogle', 'redirect URIs', {
    platform: Platform.OS,
    redirectTo,
    schemeRedirect,
    expoGoHost: Constants.expoConfig?.hostUri ?? null,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  dbg('D', 'auth.ts:signInWithGoogle', 'signInWithOAuth returned', {
    ok: !error,
    error: error?.message ?? null,
    hasUrl: Boolean(data?.url),
    oauthUrl: data?.url ? describeAuthUrl(data.url) : null,
    redirectToInOauthUrl: data?.url ? data.url.includes(encodeURIComponent(redirectTo)) : false,
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in did not return a URL.');

  if (Platform.OS === 'android') {
    await WebBrowser.warmUpAsync();
  }
  dbg('A', 'auth.ts:signInWithGoogle', 'calling openAuthSessionAsync', { redirectTo });
  let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  } finally {
    if (Platform.OS === 'android') {
      await WebBrowser.coolDownAsync();
    }
  }
  dbg('E', 'auth.ts:signInWithGoogle', 'auth session closed', {
    type: result.type,
    url: result.type === 'success' && 'url' in result ? describeAuthUrl(result.url) : null,
  });
  if (result.type !== 'success') return;
  await createSessionFromUrl(result.url);
}
