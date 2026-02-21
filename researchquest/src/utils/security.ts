/**
 * Security utilities for input validation and sanitization.
 */

/**
 * Validates if a string is a safe URL (http, https, mailto).
 * Prevents javascript: and other dangerous schemes.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  // Explicitly reject protocol-relative URLs to prevent open redirect vulnerabilities
  if (trimmed.startsWith("//")) return false;

  // Allow relative URLs (often safe in context of app navigation, but be careful)
  // For external links, we usually want http/https.
  // If it starts with /, it's relative.
  if (trimmed.startsWith("/")) return true;

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
