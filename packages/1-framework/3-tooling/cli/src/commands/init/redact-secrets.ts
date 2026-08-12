/**
 * Strips credentials out of package-manager stderr before it reaches a warning,
 * an error's meta, or a log. Two shapes carry them: userinfo inside a registry
 * URL (`https://user:token@registry…`), and the npmrc settings npm and pnpm
 * echo back when authentication fails (`//registry.npmjs.org/:_authToken=…`),
 * which are not URL-shaped and survive a userinfo-only pass.
 *
 * Both shells' `init` call this, and both call it on stderr they already
 * received from somewhere else: redaction is cheap and doubling it is harmless,
 * while trusting another layer to have done it is not.
 */
export function redactSecrets(stderr: string): string {
  return stderr
    .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/g, '$1***@')
    .replace(/(:_(?:authToken|auth|password)=)\S+/gi, '$1***');
}
