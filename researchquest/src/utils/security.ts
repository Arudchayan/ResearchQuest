/**
 * Security utilities for input validation and sanitization.
 */

/**
 * Validates if a string is a safe URL (http, https, mailto).
 * Prevents javascript: and other dangerous schemes.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  // Strip control characters and zero-width spaces that could obfuscate malicious protocols
  // eslint-disable-next-line no-control-regex
  const sanitized = url.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, "");

  const trimmed = sanitized.trim();
  if (!trimmed) return false;

  // Normalize backslashes to forward slashes to catch obfuscated protocol-relative paths
  // or bypasses like "/\javascript:alert(1)"
  const normalized = trimmed.replace(/\\/g, "/");

  // Explicitly reject protocol-relative URLs to prevent open redirect vulnerabilities
  if (normalized.startsWith("//")) return false;

  // Allow relative URLs (often safe in context of app navigation, but be careful)
  // For external links, we usually want http/https.
  // If it starts with /, it's relative.
  if (normalized.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch (e) {
    // If URL parsing fails, it might be a relative URL or invalid.
    // If we want to enforce full URLs for external links:
    return false;
  }
}

/**
 * Checks if a password meets minimum security requirements.
 * - At least 8 characters
 */
export function isStrongPassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  // Check for complexity
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  // Optional: check for special characters
  // Allow any non-alphanumeric character (including space, hyphen, underscore, etc.)
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  if (!hasUpperCase) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }
  if (!hasLowerCase) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter.",
    };
  }
  if (!hasNumbers) {
    return {
      valid: false,
      message: "Password must contain at least one number.",
    };
  }
  if (!hasSpecialChar) {
    return {
      valid: false,
      message: "Password must contain at least one special character.",
    };
  }

  return { valid: true };
}

/**
 * Maximum file size for uploads (5MB)
 * Prevents DoS attacks via large file uploads
 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validates if a file exceeds the maximum allowed size.
 */
export function validateFileSize(file: File): {
  valid: boolean;
  message?: string;
} {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      message: `File size exceeds the limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
}
