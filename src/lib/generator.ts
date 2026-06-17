// Generates `javascript:` bookmarklets from user code, with external resource injection, optional Terser minification, IIFE wrapping, and URL encoding.

export interface GenerateOptions {
	code: string;
	externalScripts: string;
	externalStyles: string;
	shouldMinify: boolean;
	shouldWrapIIFE: boolean;
	shouldEncode: boolean;
}

export interface GenerateResult {
	bookmarkletCode: string;
	sourceSize: number;
	finalSize: number;
	reduction: number;
	warnings: string[];
}

export const SIZE_LIMIT = 2000;

// Derives a stable, unicode-safe element id from a URL via a djb2 hash.
function resourceId(prefix: string, url: string): string {
	let hash = 5381;
	for (let i = 0; i < url.length; i++) {
		hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
	}
	return `${prefix}${hash.toString(36)}`;
}

// Builds the JavaScript that injects each external stylesheet as a <link>.
function buildStyleInjector(styles: string[]): string {
	let out = '';
	for (const raw of styles) {
		const loadOnce = raw.includes('!loadOnce');
		const url = raw.replace('!loadOnce', '').trim();
		const id = resourceId('bm_style_', url);

		if (loadOnce) out += `if(!document.getElementById(${JSON.stringify(id)})){`;
		out += `var l=document.createElement("link");`;
		if (loadOnce) out += `l.id=${JSON.stringify(id)};`;
		out += `l.rel="stylesheet";l.href=${JSON.stringify(url)};document.head.appendChild(l);`;
		if (loadOnce) out += `}`;
	}
	return out;
}

// Wraps the payload so an external script loads first, defining run() outside the load guard so repeat clicks re-run it; a trailing newline stops a final line comment swallowing the wrapper.
function wrapWithScript(payload: string, scriptUrl: string): string {
	const loadOnce = scriptUrl.includes('!loadOnce');
	const url = scriptUrl.replace('!loadOnce', '').trim();
	const id = resourceId('bm_script_', url);
	const onerror = `s.onerror=function(){console.error("markletsmith: failed to load "+${JSON.stringify(url)})};`;

	let out = `var run=function(){${payload}\n};`;
	if (loadOnce) out += `if(!document.getElementById(${JSON.stringify(id)})){`;
	out += `var s=document.createElement("script");`;
	if (loadOnce) out += `s.id=${JSON.stringify(id)};`;
	out += `s.src=${JSON.stringify(url)};s.onload=run;${onerror}document.body.appendChild(s);`;
	if (loadOnce) out += `}else{run()}`;
	return out;
}

// Assembles user code and resources into a `javascript:` bookmarklet URL with size stats and warnings.
export async function generateBookmarklet(options: GenerateOptions): Promise<GenerateResult> {
	const { code, externalScripts, externalStyles, shouldMinify, shouldWrapIIFE, shouldEncode } =
		options;

	const warnings: string[] = [];
	const scripts = externalScripts.split('\n').filter((s) => s.trim());
	const styles = externalStyles.split('\n').filter((s) => s.trim());

	if (!code.trim() && scripts.length === 0 && styles.length === 0) {
		warnings.push('No code to generate — write some JavaScript or add a resource.');
	}

	let finalCode = code;

	if (styles.length > 0) {
		finalCode = buildStyleInjector(styles) + finalCode;
	}

	if (scripts.length > 0) {
		for (const scriptUrl of scripts.reverse()) {
			finalCode = wrapWithScript(finalCode, scriptUrl);
		}
	}

	if (shouldWrapIIFE) finalCode = `(function(){${finalCode}})()`;

	const sourceSize = finalCode.length;
	let minifiedSize = sourceSize;

	if (shouldMinify) {
		try {
			const { minify } = await import('terser');
			const result = await minify(finalCode, { mangle: { toplevel: shouldWrapIIFE } });
			if (result.code) {
				finalCode = result.code;
				minifiedSize = finalCode.length;
			}
		} catch (err) {
			warnings.push(`Minification skipped: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	finalCode = shouldEncode
		? `javascript:${encodeURIComponent(finalCode)}`
		: `javascript:${finalCode}`;

	const finalSize = finalCode.length;
	const reduction =
		shouldMinify && sourceSize > 0
			? Math.max(0, Math.round((1 - minifiedSize / sourceSize) * 100))
			: 0;

	if (finalSize > SIZE_LIMIT) {
		warnings.push(
			`Output is ${finalSize} chars — over the ${SIZE_LIMIT}-char limit some browsers enforce.`
		);
	}

	return { bookmarkletCode: finalCode, sourceSize, finalSize, reduction, warnings };
}

// Recovers readable source from an existing bookmarklet by stripping the scheme, decoding, and unwrapping a single IIFE.
export function decodeBookmarklet(input: string): string {
	let s = input.trim();
	if (s.toLowerCase().startsWith('javascript:')) s = s.slice('javascript:'.length);

	if (/%[0-9a-fA-F]{2}/.test(s)) {
		try {
			s = decodeURIComponent(s);
		} catch {
			return s.trim();
		}
	}

	const iife = s.match(/^\(\s*(?:function\s*\(\s*\)|\(\s*\)\s*=>)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?$/);
	if (iife) s = iife[1];

	return s.trim();
}
