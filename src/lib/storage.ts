// localStorage persistence for the editor state and the saved-snippet library; all access is guarded so the module is safe during SSR/prerender.

import type { Snippet } from './snippets';

const STATE_KEY = 'markletsmith:state';
const SNIPPETS_KEY = 'markletsmith:snippets';

export interface EditorState {
	bookmarkletName: string;
	code: string;
	externalScripts: string;
	externalStyles: string;
	shouldMinify: boolean;
	shouldWrapIIFE: boolean;
	shouldEncode: boolean;
}

// Returns localStorage when available, or null in environments without it.
function storage(): Storage | null {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch {
		return null;
	}
}

// Persists the working editor state, ignoring any storage failures.
export function saveState(state: EditorState): void {
	const s = storage();
	if (!s) return;
	try {
		s.setItem(STATE_KEY, JSON.stringify(state));
	} catch {
		return;
	}
}

// Reads a previously persisted editor state, or null if none/invalid.
export function loadState(): EditorState | null {
	const s = storage();
	if (!s) return null;
	try {
		const raw = s.getItem(STATE_KEY);
		return raw ? (JSON.parse(raw) as EditorState) : null;
	} catch {
		return null;
	}
}

// Reads the saved snippet library, newest first, or an empty list.
export function loadSnippets(): Snippet[] {
	const s = storage();
	if (!s) return [];
	try {
		const raw = s.getItem(SNIPPETS_KEY);
		const list = raw ? (JSON.parse(raw) as Snippet[]) : [];
		return Array.isArray(list) ? list.sort((a, b) => b.savedAt - a.savedAt) : [];
	} catch {
		return [];
	}
}

// Overwrites the saved snippet library, ignoring any storage failures.
export function saveSnippets(list: Snippet[]): void {
	const s = storage();
	if (!s) return;
	try {
		s.setItem(SNIPPETS_KEY, JSON.stringify(list));
	} catch {
		return;
	}
}
