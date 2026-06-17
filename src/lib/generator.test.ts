// Unit tests for the generator, decoder, share-state, and bookmark-export helpers.

import { describe, it, expect } from 'vitest';
import { generateBookmarklet, decodeBookmarklet, SIZE_LIMIT } from './generator';
import { encodeState, decodeState } from './share';
import { buildBookmarksHtml } from './bookmarks';
import type { EditorState } from './storage';

const base = {
	code: '',
	externalScripts: '',
	externalStyles: '',
	shouldMinify: false,
	shouldWrapIIFE: false,
	shouldEncode: false
};

// Asserts the body of a bookmarklet parses as valid JavaScript.
function assertValid(bookmarklet: string) {
	const body = bookmarklet.replace(/^javascript:/, '');
	expect(() => new Function(body)).not.toThrow();
}

describe('generateBookmarklet', () => {
	it('prefixes output with javascript:', async () => {
		const r = await generateBookmarklet({ ...base, code: 'alert(1)' });
		expect(r.bookmarkletCode.startsWith('javascript:')).toBe(true);
	});

	it('URI-encodes when requested', async () => {
		const r = await generateBookmarklet({ ...base, code: 'alert(1)', shouldEncode: true });
		expect(r.bookmarkletCode).toContain('%');
	});

	it('wraps in an IIFE when requested', async () => {
		const r = await generateBookmarklet({ ...base, code: 'var x=1', shouldWrapIIFE: true });
		expect(r.bookmarkletCode).toContain('(function(){');
	});

	it('escapes quotes in resource URLs', async () => {
		const r = await generateBookmarklet({
			...base,
			code: 'x()',
			externalStyles: 'https://x.com/a.css?q="onerror'
		});
		assertValid(r.bookmarkletCode);
	});

	it('survives a trailing // comment with an external script', async () => {
		const r = await generateBookmarklet({
			...base,
			code: 'doStuff(); // run it',
			externalScripts: 'https://cdn.example.com/lib.js'
		});
		assertValid(r.bookmarkletCode);
	});

	it('handles non-Latin1 resource URLs without throwing', async () => {
		const r = await generateBookmarklet({
			...base,
			code: 'x()',
			externalStyles: '!loadOnce https://例え.jp/s.css'
		});
		assertValid(r.bookmarkletCode);
	});

	it('loadOnce script calls run() in the else branch', async () => {
		const r = await generateBookmarklet({
			...base,
			code: "alert('hi')",
			externalScripts: '!loadOnce https://lib.js'
		});
		expect(r.bookmarkletCode).toContain('}else{run()}');
		expect(r.bookmarkletCode).not.toContain("(alert('hi'))()");
		assertValid(r.bookmarkletCode);
	});

	it('loads multiple scripts in listed order before the payload', async () => {
		const r = await generateBookmarklet({
			...base,
			code: 'PAYLOAD()',
			externalScripts: 'https://a.js\nhttps://b.js'
		});
		assertValid(r.bookmarkletCode);
		expect(r.bookmarkletCode).toContain('https://a.js');
		expect(r.bookmarkletCode).toContain('https://b.js');
	});

	it('reports reduction of 0 when minification is off', async () => {
		const r = await generateBookmarklet({ ...base, code: 'const value = 1;', shouldEncode: true });
		expect(r.reduction).toBe(0);
	});

	it('warns on empty input', async () => {
		const r = await generateBookmarklet({ ...base, code: '   ' });
		expect(r.warnings.some((w) => w.toLowerCase().includes('no code'))).toBe(true);
	});

	it('warns when output exceeds the size limit', async () => {
		const big = 'x'.repeat(SIZE_LIMIT + 100);
		const r = await generateBookmarklet({ ...base, code: big });
		expect(r.warnings.some((w) => w.includes(String(SIZE_LIMIT)))).toBe(true);
	});

	it('minifies and shrinks verbose code', async () => {
		const verbose = `function add(firstNumber, secondNumber) {\n  const total = firstNumber + secondNumber;\n  return total;\n}\nconsole.log(add(1, 2));`;
		const r = await generateBookmarklet({ ...base, code: verbose, shouldMinify: true });
		expect(r.reduction).toBeGreaterThan(0);
		assertValid(r.bookmarkletCode);
	});
});

describe('decodeBookmarklet', () => {
	it('round-trips an encoded IIFE bookmarklet back to source', async () => {
		const original = 'alert("hi & bye")';
		const made = await generateBookmarklet({
			...base,
			code: original,
			shouldWrapIIFE: true,
			shouldEncode: true
		});
		expect(decodeBookmarklet(made.bookmarkletCode)).toBe(original);
	});

	it('strips the javascript: scheme', () => {
		expect(decodeBookmarklet('javascript:alert(1)')).toBe('alert(1)');
	});

	it('leaves plain source untouched', () => {
		expect(decodeBookmarklet('const x = 1;')).toBe('const x = 1;');
	});
});

describe('share state', () => {
	it('round-trips unicode state through the URL token', () => {
		const state: EditorState = {
			bookmarkletName: 'café ☕',
			code: "console.log('héllo 日本')",
			externalScripts: '',
			externalStyles: '',
			shouldMinify: true,
			shouldWrapIIFE: true,
			shouldEncode: true
		};
		const token = encodeState(state);
		expect(token).not.toMatch(/[+/=]/);
		expect(decodeState(token)).toEqual(state);
	});

	it('returns null on malformed tokens', () => {
		expect(decodeState('@@@not-base64@@@')).toBeNull();
	});
});

describe('bookmarks export', () => {
	it('escapes HTML in names and URLs', () => {
		const html = buildBookmarksHtml([{ name: 'my "tool"', url: 'javascript:alert("a & b <c>")' }]);
		expect(html).toContain('&quot;');
		expect(html).toContain('&amp;');
		expect(html).toContain('&lt;c&gt;');
		expect(html).toContain('NETSCAPE-Bookmark-file-1');
	});
});
