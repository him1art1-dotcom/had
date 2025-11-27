const HASH_REGEX = /^[a-f0-9]{64}$/i;

export const isHashed = (value?: string | null): boolean => {
  return !!value && HASH_REGEX.test(value);
};

export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  if (isHashed(password)) return password;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    console.warn('Password hashing fallback triggered', e);
    // Last-resort fallback to avoid breaking login flows
    return btoa(password);
  }
}
