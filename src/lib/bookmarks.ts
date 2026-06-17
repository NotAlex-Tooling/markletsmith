// Builds and downloads a Netscape bookmark file so a generated bookmarklet can be imported directly into the browser.

export interface BookmarkItem {
	name: string;
	url: string;
}

// Escapes text for safe inclusion in HTML attributes and text nodes.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Produces a Netscape-format bookmark document from the given items.
export function buildBookmarksHtml(items: BookmarkItem[]): string {
	const rows = items
		.map((item) => `    <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.name || 'Bookmarklet')}</A>`)
		.join('\n');

	return [
		'<!DOCTYPE NETSCAPE-Bookmark-file-1>',
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		'<TITLE>Bookmarks</TITLE>',
		'<H1>Bookmarks</H1>',
		'<DL><p>',
		rows,
		'</DL><p>',
		''
	].join('\n');
}

// Triggers a client-side download of the bookmark file.
export function downloadBookmarksHtml(items: BookmarkItem[], filename = 'markletsmith-bookmarks.html'): void {
	if (typeof document === 'undefined') return;
	const blob = new Blob([buildBookmarksHtml(items)], { type: 'text/html;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
