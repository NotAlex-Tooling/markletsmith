// Encodes the editor configuration into a URL-safe hash fragment so a build can be shared by link and restored on load.

import type { EditorState } from './storage';

const HASH_PREFIX = 's=';

// Encodes a string to URL-safe base64, preserving unicode via UTF-8 bytes.
function toBase64Url(input: string): string {
	const bytes = new TextEncoder().encode(input);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Decodes a URL-safe base64 string produced by toBase64Url.
function fromBase64Url(input: string): string {
	const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

// Serializes editor state to a compact, URL-safe token.
export function encodeState(state: EditorState): string {
	return toBase64Url(JSON.stringify(state));
}

// Parses a token back into editor state, or null if malformed.
export function decodeState(token: string): EditorState | null {
	try {
		return JSON.parse(fromBase64Url(token)) as EditorState;
	} catch {
		return null;
	}
}

// Builds a full shareable URL for the given state from the current origin and path.
export function buildShareUrl(state: EditorState): string {
	const base =
		typeof location !== 'undefined'
			? `${location.origin}${location.pathname}`
			: 'https://markletsmith.app/';
	return `${base}#${HASH_PREFIX}${encodeState(state)}`;
}

// Reads shared state from the current URL hash, or null if absent.
export function readStateFromHash(): EditorState | null {
	if (typeof location === 'undefined') return null;
	const hash = location.hash.replace(/^#/, '');
	if (!hash.startsWith(HASH_PREFIX)) return null;
	return decodeState(hash.slice(HASH_PREFIX.length));
}
