export function getPasswordStrength(password: string): number {
  return (
    [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
    ].filter(Boolean).length * 25
  );
}
