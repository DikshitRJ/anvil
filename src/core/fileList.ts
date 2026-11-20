// Pure file-list filtering for list_files: directory prefix plus a glob matched on the full workspace-relative path.
import picomatch from 'picomatch';

export function filterFiles(files: string[], dir = '', glob?: string, limit = 200): string[] {
  const prefix = dir && dir !== '.' ? dir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/?$/, '/') : '';
  const match = glob ? picomatch(glob, { dot: true, matchBase: !glob.includes('/') }) : () => true;
  return files.filter((f) => f.startsWith(prefix) && match(f)).slice(0, limit);
}
