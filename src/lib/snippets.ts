// Saved-snippet model and the set of ready-to-use starter templates offered in the library.

export interface Snippet {
	id: string;
	name: string;
	code: string;
	externalScripts: string;
	externalStyles: string;
	savedAt: number;
}

export interface Template {
	name: string;
	description: string;
	code: string;
}

// Generates a short unique id for a saved snippet.
export function newSnippetId(): string {
	return `snip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const TEMPLATES: Template[] = [
	{
		name: 'hello world',
		description: 'Minimal alert to confirm a bookmarklet runs.',
		code: `alert('Hello from your bookmarklet!');`
	},
	{
		name: 'prompt for input',
		description: 'Ask the user for a value at click time, then use it.',
		code: `const term = prompt('Search for:');\nif (term) {\n  window.open('https://www.google.com/search?q=' + encodeURIComponent(term), '_blank');\n}`
	},
	{
		name: 'edit any page',
		description: 'Toggle designMode so you can type directly into the page.',
		code: `document.designMode = document.designMode === 'on' ? 'off' : 'on';`
	},
	{
		name: 'list every link',
		description: 'Open a new tab listing all hrefs on the current page.',
		code: `const links = [...document.querySelectorAll('a[href]')].map((a) => a.href);\nconst w = window.open('', '_blank');\nw.document.write('<pre>' + links.join('\\n') + '</pre>');`
	},
	{
		name: 'reveal passwords',
		description: 'Switch every password field to plain text.',
		code: `document.querySelectorAll('input[type=password]').forEach((i) => (i.type = 'text'));`
	},
	{
		name: 'highlight selection',
		description: 'Wrap the current text selection in a yellow highlight.',
		code: `const sel = window.getSelection();\nif (sel && sel.rangeCount && !sel.isCollapsed) {\n  const mark = document.createElement('mark');\n  mark.style.background = '#ffeb3b';\n  sel.getRangeAt(0).surroundContents(mark);\n}`
	}
];
