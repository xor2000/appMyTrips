/** SVG chargés par `import.meta.glob`, indexés par identifiant (nom du fichier sans `.svg`). */
export function byId(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, svg]) => [path.replace(/^.*\/|\.svg$/g, ''), svg.trim()]),
  );
}
