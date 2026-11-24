import { dev } from "$app/env";

const EDITOR = dev ? "http://localhost:5173" : "https://editor.allaparte.com";

export function editorUrl(pieceId: string): string {
  return `${EDITOR}/#live=${pieceId}`;
}
