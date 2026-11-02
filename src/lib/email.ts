// Emails typed on phones (especially iPhone with an Arabic keyboard) often carry invisible
// direction marks or spaces, e.g. "name@gmail.com‬‏". The email service rejects
// those addresses, so verification codes never arrive. Clean them before using the email.
export const normalizeEmail = (value: string) =>
  value.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "").toLowerCase();

/** A usable email address: plain English letters, digits and symbols only. */
export const isValidEmail = (value: string) =>
  /^[\x21-\x3f\x41-\x7e]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
