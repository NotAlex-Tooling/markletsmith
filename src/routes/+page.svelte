<!-- Main page: bookmarklet editor UI with code input, options, output, and sidebar guide -->
<script lang="ts">
	import { onMount } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import {
		generateBookmarklet,
		decodeBookmarklet,
		SIZE_LIMIT,
		type GenerateResult
	} from '$lib/generator';
	import { TEMPLATES, newSnippetId, type Snippet, type Template } from '$lib/snippets';
	import {
		loadState,
		saveState,
		loadSnippets,
		saveSnippets,
		type EditorState
	} from '$lib/storage';
	import { buildShareUrl, readStateFromHash } from '$lib/share';
	import { downloadBookmarksHtml } from '$lib/bookmarks';

	const DEFAULTS: EditorState = {
		bookmarkletName: '',
		code: '',
		externalScripts: '',
		externalStyles: '',
		shouldMinify: true,
		shouldWrapIIFE: true,
		shouldEncode: true
	};

	// Resolves initial state from a shared link, then localStorage, then defaults.
	function initialState(): EditorState {
		return readStateFromHash() ?? loadState() ?? DEFAULTS;
	}
	const init = initialState();

	let mode = $state<'build' | 'decode'>('build');

	let bookmarkletName = $state(init.bookmarkletName);
	let code = $state(init.code);
	let externalScripts = $state(init.externalScripts);
	let externalStyles = $state(init.externalStyles);
	let shouldMinify = $state(init.shouldMinify);
	let shouldWrapIIFE = $state(init.shouldWrapIIFE);
	let shouldEncode = $state(init.shouldEncode);

	let isLoading = $state(false);
	let result: GenerateResult | null = $state(null);
	let error: string | null = $state(null);
	let showOutput = $state(false);
	let toastVisible = $state(false);
	let toastMessage = $state('Copied to clipboard');
	let mounted = $state(false);
	let hydrated = $state(false);

	let snippets = $state<Snippet[]>([]);

	let decodeInput = $state('');
	let decodedOutput = $state('');

	const sizePct = $derived(
		result ? Math.min(100, Math.round((result.finalSize / SIZE_LIMIT) * 100)) : 0
	);
	const sizeStatus = $derived(
		!result
			? 'ok'
			: result.finalSize > SIZE_LIMIT
				? 'over'
				: result.finalSize > SIZE_LIMIT * 0.75
					? 'warn'
					: 'ok'
	);

	// Captures the current editor fields as a persistable state object.
	function snapshot(): EditorState {
		return {
			bookmarkletName,
			code,
			externalScripts,
			externalStyles,
			shouldMinify,
			shouldWrapIIFE,
			shouldEncode
		};
	}

	// Runs the generator and stores the result or error.
	async function handleGenerate() {
		isLoading = true;
		error = null;
		showOutput = true;
		try {
			result = await generateBookmarklet(snapshot());
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			result = null;
		} finally {
			isLoading = false;
		}
	}

	// Copies the generated bookmarklet to the clipboard.
	function copyCode() {
		if (!result) return;
		navigator.clipboard
			.writeText(result.bookmarkletCode)
			.then(() => showToast('Copied to clipboard'))
			.catch(() => showToast('Copy failed — select the code and copy manually'));
	}

	// Copies a shareable URL and updates the address bar.
	function shareLink() {
		const url = buildShareUrl(snapshot());
		if (typeof history !== 'undefined') history.replaceState(null, '', url);
		navigator.clipboard
			.writeText(url)
			.then(() => showToast('Share link copied'))
			.catch(() => showToast('Link is in the address bar — copy it from there'));
	}

	// Downloads the current bookmarklet as an importable bookmark file.
	function exportHtml() {
		if (!result) return;
		const name = (bookmarkletName || 'Bookmarklet').trim();
		downloadBookmarksHtml([{ name, url: result.bookmarkletCode }]);
		showToast('Bookmark file downloaded');
	}

	// Saves the current editor contents as a reusable snippet.
	function saveCurrentSnippet() {
		if (!code.trim()) {
			showToast('Nothing to save yet');
			return;
		}
		const snip: Snippet = {
			id: newSnippetId(),
			name: (bookmarkletName || 'untitled').trim(),
			code,
			externalScripts,
			externalStyles,
			savedAt: Date.now()
		};
		snippets = [snip, ...snippets];
		saveSnippets(snippets);
		showToast('Snippet saved');
	}

	// Loads a saved snippet into the editor and switches to build mode.
	function loadSnippet(s: Snippet) {
		bookmarkletName = s.name;
		code = s.code;
		externalScripts = s.externalScripts;
		externalStyles = s.externalStyles;
		mode = 'build';
		showToast('Snippet loaded');
	}

	// Removes a snippet from the library and persists the change.
	function deleteSnippet(id: string) {
		snippets = snippets.filter((s) => s.id !== id);
		saveSnippets(snippets);
	}

	// Loads a starter template into the editor and switches to build mode.
	function insertTemplate(t: Template) {
		code = t.code;
		mode = 'build';
		showToast(`Inserted "${t.name}"`);
	}

	// Empties the code editor.
	function clearCode() {
		code = '';
		showToast('Editor cleared');
	}

	// Recovers readable source from a pasted bookmarklet.
	function runDecode() {
		decodedOutput = decodeBookmarklet(decodeInput);
	}

	// Moves recovered source into the editor and switches to build mode.
	function loadDecodedIntoEditor() {
		code = decodedOutput;
		mode = 'build';
		showToast('Loaded into editor');
	}

	// Shows a toast notification that auto-dismisses after two seconds.
	function showToast(msg: string) {
		toastMessage = msg;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 2000);
	}

	// Loads the saved snippet library and marks the component hydrated.
	onMount(() => {
		mounted = true;
		snippets = loadSnippets();
		hydrated = true;
	});

	// Persists the working state, debounced, after hydration.
	let saveTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const state = snapshot();
		if (!hydrated) return;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => saveState(state), 300);
	});
</script>

<svelte:head>
	<title>Markletsmith</title>
	<meta name="description" content="Bookmarklet forge - build, minify, and deploy JavaScript bookmarklets" />
</svelte:head>

<div class="app">
	<div class="scanline"></div>
	<div class="grid-bg"></div>

	<div class="container" class:mounted>
		<header class="header">
			<img src="/logo.png" alt="markletsmith logo" class="header-logo" />
			<div>
				<h1 class="title">markletsmith</h1>
				<p class="subtitle">bookmarklet forge</p>
			</div>
		</header>

		<div class="layout">
			<div class="main-col">
				<div class="tabs">
					<button class="tab" class:active={mode === 'build'} onclick={() => (mode = 'build')}>build</button>
					<button class="tab" class:active={mode === 'decode'} onclick={() => (mode = 'decode')}>decode</button>
				</div>

				{#if mode === 'build'}
					<div class="card" style="animation-delay: 0.1s">
					<div class="toolbar">
						<div class="toolbar-name">
							<label class="label" for="bm-name">NAME</label>
							<input
								id="bm-name"
								type="text"
								class="input input-sm"
								bind:value={bookmarkletName}
								placeholder="my-script"
							/>
						</div>
						<div class="toggles">
							<label class="toggle-label">
								<input type="checkbox" bind:checked={shouldMinify} />
								<span class="toggle-track"><span class="toggle-knob"></span></span>
								<span class="toggle-text">minify</span>
							</label>
							<label class="toggle-label">
								<input type="checkbox" bind:checked={shouldWrapIIFE} />
								<span class="toggle-track"><span class="toggle-knob"></span></span>
								<span class="toggle-text">iife</span>
							</label>
							<label class="toggle-label">
								<input type="checkbox" bind:checked={shouldEncode} />
								<span class="toggle-track"><span class="toggle-knob"></span></span>
								<span class="toggle-text">encode</span>
							</label>
						</div>
					</div>

					<div class="snippet-bar">
						<button class="btn-ghost" onclick={saveCurrentSnippet}>+ save snippet</button>
						<button class="btn-ghost" onclick={clearCode}>clear</button>
					</div>

					<div class="field">
						<span class="label">CODE</span>
						<CodeEditor bind:value={code} />
						<p class="hint">Write JavaScript here, then hit generate. Test in devtools first.</p>
					</div>

					<div class="ext-grid">
						<div class="field">
							<label class="label" for="ext-scripts">EXTERNAL SCRIPTS</label>
							<textarea
								id="ext-scripts"
								class="input textarea"
								bind:value={externalScripts}
								placeholder="https://cdn.example.com/lib.js"
							></textarea>
						</div>
						<div class="field">
							<label class="label" for="ext-styles">EXTERNAL STYLES</label>
							<textarea
								id="ext-styles"
								class="input textarea"
								bind:value={externalStyles}
								placeholder="https://cdn.example.com/style.css"
							></textarea>
						</div>
					</div>

					<button
						class="btn-generate"
						onclick={handleGenerate}
						disabled={isLoading}
					>
						{#if isLoading}
							<span class="spinner"></span>
							generating...
						{:else}
							<span class="bolt">&gt;</span> generate
						{/if}
					</button>
				</div>

								{#if showOutput}
					<div class="card output-card" style="animation-delay: 0.2s">
						{#if isLoading}
							<div class="loading">
								<div class="loader"></div>
								<p>forging bookmarklet...</p>
							</div>
						{:else if error}
							<div class="error-msg">{error}</div>
						{:else if result}
							<div class="card-header">
								<span class="card-icon">[ok]</span>
								<span>output</span>
							</div>

							<div class="output-section">
								<p class="drag-hint">Drag to bookmarks bar:</p>
								<a
									class="bookmarklet-link"
									href={result.bookmarkletCode}
									title="Drag me to your bookmarks bar"
								>
									{bookmarkletName || 'Bookmarklet'}
									</a>
								</div>

								<div class="output-section">
									<div class="meter-head">
										<span class="label">SIZE</span>
										<span class="meter-count {sizeStatus}">{result.finalSize} / {SIZE_LIMIT}</span>
									</div>
									<div class="meter-bar"><div class="meter-fill {sizeStatus}" style="width:{sizePct}%"></div></div>
								</div>

								{#if result.warnings.length}
									<div class="warnings">
										{#each result.warnings as w}
											<div class="warning"><span class="warn-icon">!</span> {w}</div>
										{/each}
									</div>
								{/if}

							<div class="output-section">
								<div class="output-header">
									<span class="label">BOOKMARKLET CODE</span>
									<div class="output-actions">
											<button class="btn-copy" onclick={copyCode}>copy</button>
											<button class="btn-copy" onclick={shareLink}>share link</button>
											<button class="btn-copy" onclick={exportHtml}>export .html</button>
										</div>
									</div>
								<div class="code-output">{result.bookmarkletCode}</div>
							</div>

							<div class="stats">
									<div class="stat">
										<span class="stat-label">source</span>
										<span class="stat-value">{result.sourceSize}b</span>
									</div>
									<div class="stat">
										<span class="stat-label">final</span>
										<span class="stat-value accent">{result.finalSize}b</span>
									</div>
									<div class="stat">
										<span class="stat-label">reduction</span>
										<span class="stat-value success">{result.reduction}%</span>
									</div>
								</div>
						{/if}
					</div>
				{/if}
				{:else}
					<div class="card decode-card" style="animation-delay: 0.1s">
						<div class="card-header">
							<span class="card-icon">&lt;/&gt;</span>
							<span>decode</span>
						</div>
						<p class="hint" style="margin-bottom:8px">Paste an existing bookmarklet to recover its source.</p>
						<textarea class="input textarea-lg" bind:value={decodeInput} placeholder="javascript:(function()&#123;...&#125;)()"></textarea>
						<button class="btn-generate" onclick={runDecode} style="margin-top:12px"><span class="bolt">&gt;</span> decode</button>
						{#if decodedOutput}
							<div class="output-section" style="margin-top:16px">
								<div class="output-header">
									<span class="label">RECOVERED SOURCE</span>
									<button class="btn-copy" onclick={loadDecodedIntoEditor}>load into editor</button>
								</div>
								<pre class="code-output decode-output">{decodedOutput}</pre>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="sidebar">
				<div class="card lib-card" style="animation-delay: 0.25s">
					<div class="card-header">
						<span class="card-icon">#</span>
						<span>library</span>
					</div>
					<div class="lib-block">
						<h4>templates</h4>
						<div class="chips">
							{#each TEMPLATES as t}
								<button class="chip" title={t.description} onclick={() => insertTemplate(t)}>{t.name}</button>
							{/each}
						</div>
					</div>
					<div class="lib-block">
						<h4>saved snippets</h4>
						{#if snippets.length === 0}
							<p class="empty">Nothing saved yet — use "save snippet" to keep a build.</p>
						{:else}
							<ul class="snip-list">
								{#each snippets as s (s.id)}
									<li class="snip-row">
										<button class="snip-name" onclick={() => loadSnippet(s)} title="Load into editor">{s.name}</button>
										<button class="icon-btn" onclick={() => deleteSnippet(s.id)} title="Delete" aria-label="Delete snippet">×</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>

				<div class="card" style="animation-delay: 0.3s">
					<div class="card-header">
						<span class="card-icon">?</span>
						<span>how it works</span>
					</div>

					<div class="guide-section">
						<h4>what is a bookmarklet?</h4>
						<p class="guide-desc">A bookmarklet is a small piece of JavaScript saved as a browser bookmark. Click it on any page and it runs your code on that page.</p>
					</div>

					<div class="guide-section">
						<h4>1. write your code</h4>
						<p class="guide-desc">Write any JavaScript in the editor. It will run on whatever page you activate the bookmarklet from.</p>
					</div>

					<div class="guide-section">
						<h4>2. hit generate</h4>
						<p class="guide-desc">Your code gets minified, wrapped in an IIFE to avoid polluting the page, and encoded into a <code>javascript:</code> URL.</p>
					</div>

					<div class="guide-section">
						<h4>3. drag to bookmarks bar</h4>
						<p class="guide-desc">Drag the output button to your browser's bookmarks bar. Click it on any page to run your script.</p>
					</div>

					<div class="guide-section">
						<h4>options</h4>
						<ul class="guide-list">
							<li><span class="bullet">&gt;</span> <strong>minify</strong> — shrink code with terser</li>
							<li><span class="bullet">&gt;</span> <strong>iife</strong> — wrap in a function to prevent variable leaks</li>
							<li><span class="bullet">&gt;</span> <strong>encode</strong> — URI-encode for browser compatibility</li>
						</ul>
					</div>

					<div class="guide-section hide-mobile">
						<h4>external resources</h4>
						<p class="guide-desc">Load CDN scripts/styles. Prefix with <code>!loadOnce</code> to prevent duplicate injection:</p>
						<pre><code>!loadOnce https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js</code></pre>
					</div>

					<div class="guide-section">
						<h4>tips</h4>
						<ul class="guide-list">
							<li><span class="check">+</span> keep code under 2000 chars</li>
							<li><span class="check">+</span> test in devtools console first</li>
							<li><span class="check">+</span> use const/let, not var</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

		<footer class="site-footer">
			<a href="https://github.com/NotAlex-Tooling/" target="_blank" rel="noopener noreferrer">Tooling by NotAlex</a>
			<span class="sep">·</span>
			<a href="https://github.com/NotAlex-Tooling/markletsmith" target="_blank" rel="noopener noreferrer">source code</a>
		</footer>
	</div>

		<div class="toast" class:show={toastVisible}>
		<span class="toast-check">+</span> {toastMessage}
	</div>
</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		background: #000;
		color: #c8c8c8;
		font-family: 'JetBrains Mono', monospace;
		min-height: 100vh;
		overflow-x: hidden;
	}

	:global(::selection) {
		background: rgba(100, 160, 255, 0.25);
		color: #fff;
	}

	:global(::-webkit-scrollbar) {
		width: 6px;
		height: 6px;
	}
	:global(::-webkit-scrollbar-track) {
		background: #0a0a0a;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: #333;
		border-radius: 3px;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: #555;
	}

	.app {
		position: relative;
		min-height: 100vh;
	}

	.scanline {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgba(255, 255, 255, 0.006) 2px,
			rgba(255, 255, 255, 0.006) 4px
		);
		pointer-events: none;
		z-index: 100;
		animation: scanlineScroll 8s linear infinite;
	}

	@keyframes scanlineScroll {
		0% { background-position: 0 0; }
		100% { background-position: 0 100px; }
	}

	.grid-bg {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
		background-size: 40px 40px;
		pointer-events: none;
		z-index: 0;
	}

	.container {
		position: relative;
		z-index: 1;
		max-width: 1100px;
		margin: 0 auto;
		padding: 20px 16px;
		opacity: 0;
		transform: translateY(10px);
		transition: opacity 0.6s ease, transform 0.6s ease;
	}

	.container.mounted {
		opacity: 1;
		transform: translateY(0);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 20px;
		animation: fadeIn 0.8s ease forwards;
	}

	.header-logo {
		width: 40px;
		height: auto;
		opacity: 0.85;
		filter: drop-shadow(0 0 6px rgba(122, 162, 212, 0.3));
		transition: filter 0.3s, opacity 0.3s;
	}

	.header-logo:hover {
		opacity: 1;
		filter: drop-shadow(0 0 10px rgba(122, 162, 212, 0.5));
	}

	.title {
		font-size: clamp(20px, 3.5vw, 28px);
		font-weight: 400;
		letter-spacing: 2px;
		color: #e0e0e0;
		line-height: 1;
		margin-bottom: 4px;
	}

	.subtitle {
		font-size: 10px;
		color: #888;
		font-weight: 400;
		letter-spacing: 3px;
		text-transform: uppercase;
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 14px;
	}

	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: 5fr 2fr;
		}
	}

	.main-col {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.card {
		background: #0a0a0a;
		border: 1px solid #1e1e1e;
		padding: 16px;
		position: relative;
		animation: slideUp 0.5s ease forwards;
		opacity: 0;
		transition: border-color 0.3s;
	}

	.card:hover {
		border-color: #2a2a2a;
	}

	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(100, 160, 255, 0.15), transparent);
		opacity: 0;
		transition: opacity 0.3s;
	}

	.card:hover::before {
		opacity: 1;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		font-size: 13px;
		font-weight: 600;
		color: #e0e0e0;
		text-transform: lowercase;
		letter-spacing: 1px;
	}

	.card-icon {
		color: #7aa2d4;
		font-weight: 400;
	}

	.toolbar {
		display: flex;
		align-items: flex-end;
		gap: 16px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.toolbar-name {
		flex: 1;
		min-width: 140px;
	}

	.field {
		margin-bottom: 12px;
	}

	.label {
		display: block;
		font-size: 10px;
		color: #777;
		font-weight: 600;
		letter-spacing: 2px;
		margin-bottom: 5px;
	}

	.input {
		width: 100%;
		background: #070707;
		border: 1px solid #1e1e1e;
		color: #d0d0d0;
		padding: 8px 10px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 13px;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.input:focus {
		outline: none;
		border-color: #4a7ab5;
		box-shadow: 0 0 0 1px rgba(100, 160, 255, 0.15);
	}

	.input::placeholder {
		color: #555;
	}

	.input-sm {
		padding: 6px 10px;
	}

	.textarea {
		height: 64px;
		resize: vertical;
	}

	.textarea::placeholder {
		font-size: 11px;
	}

	.hint {
		font-size: 10px;
		color: #777;
		margin-top: 4px;
	}

	.toggles {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		align-items: center;
		padding-bottom: 2px;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;
	}

	.toggle-label input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-track {
		position: relative;
		width: 32px;
		height: 16px;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		display: flex;
		align-items: center;
		transition: background 0.3s, border-color 0.3s;
		border-radius: 1px;
	}

	.toggle-knob {
		position: absolute;
		left: 2px;
		width: 10px;
		height: 10px;
		background: #555;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;
	}

	.toggle-label input:checked + .toggle-track {
		background: #1a2a3a;
		border-color: #4a7ab5;
	}

	.toggle-label input:checked + .toggle-track .toggle-knob {
		transform: translateX(14px);
		background: #7aa2d4;
	}

	.toggle-text {
		font-size: 11px;
		color: #666;
		transition: color 0.2s;
	}

	.toggle-label input:checked ~ .toggle-text {
		color: #aaa;
	}

	.ext-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		margin-bottom: 12px;
	}

	@media (min-width: 640px) {
		.ext-grid {
			grid-template-columns: 1fr 1fr;
		}
		.ext-grid .field {
			margin-bottom: 0;
		}
	}

	.btn-generate {
		width: 100%;
		background: #e8e8e8;
		color: #000;
		border: none;
		padding: 11px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 1px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.2s;
		text-transform: lowercase;
		position: relative;
		overflow: hidden;
	}

	.btn-generate::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.05), transparent);
		transition: left 0.5s;
	}

	.btn-generate:hover::after {
		left: 100%;
	}

	.btn-generate:hover {
		background: #fff;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.08);
	}

	.btn-generate:active {
		transform: scale(0.99);
	}

	.btn-generate:disabled {
		background: #1a1a1a;
		color: #555;
		cursor: not-allowed;
	}

	.bolt {
		font-weight: 400;
		color: #999;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid #444;
		border-top-color: #888;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.output-card {
		animation: slideUp 0.4s ease forwards !important;
	}

	.loading {
		text-align: center;
		padding: 24px 0;
	}

	.loader {
		width: 20px;
		height: 20px;
		border: 2px dashed #555;
		border-radius: 50%;
		animation: spin 2s linear infinite;
		margin: 0 auto 10px;
	}

	.loading p {
		color: #666;
		font-size: 11px;
	}

	.error-msg {
		color: #e06060;
		font-size: 11px;
		padding: 12px;
		border-left: 2px solid #e06060;
		background: #100808;
	}

	.output-section {
		margin-bottom: 14px;
	}

	.drag-hint {
		font-size: 10px;
		color: #666;
		margin-bottom: 6px;
	}

	.bookmarklet-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #e8e8e8;
		color: #000;
		padding: 10px 20px;
		text-decoration: none;
		font-weight: 700;
		font-size: 13px;
		font-family: 'JetBrains Mono', monospace;
		transition: all 0.3s;
		position: relative;
		overflow: hidden;
		letter-spacing: 0.5px;
	}

	.bookmarklet-link::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.08), transparent);
		transition: left 0.6s;
	}

	.bookmarklet-link:hover::before {
		left: 100%;
	}

	.bookmarklet-link:hover {
		background: #fff;
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.output-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.output-header .label {
		margin-bottom: 0;
	}

	.btn-copy {
		background: transparent;
		border: 1px solid #2a2a2a;
		color: #999;
		padding: 3px 10px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-copy:hover {
		background: #111;
		border-color: #4a7ab5;
		color: #d0d0d0;
	}

	.code-output {
		background: #050505;
		border: 1px solid #1e1e1e;
		padding: 10px;
		font-size: 11px;
		color: #888;
		word-break: break-all;
		max-height: 160px;
		overflow-y: auto;
		line-height: 1.6;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.stat {
		background: #070707;
		border: 1px solid #1e1e1e;
		padding: 8px 10px;
		transition: border-color 0.2s;
	}

	.stat:hover {
		border-color: #2a2a2a;
	}

	.stat-label {
		display: block;
		font-size: 9px;
		color: #666;
		letter-spacing: 1px;
		margin-bottom: 2px;
	}

	.stat-value {
		font-size: 13px;
		font-weight: 700;
		color: #e0e0e0;
	}

	.stat-value.accent {
		color: #7aa2d4;
	}

	.stat-value.success {
		color: #7ab87a;
	}

	.sidebar .card {
		position: sticky;
		top: 20px;
	}

	.guide-section {
		background: #070707;
		border: 1px solid #181818;
		padding: 10px;
		margin-bottom: 6px;
		transition: border-color 0.2s;
	}

	.guide-section:last-child {
		margin-bottom: 0;
	}

	.guide-section:hover {
		border-color: #2a2a2a;
	}

	.guide-section h4 {
		font-size: 11px;
		color: #ccc;
		font-weight: 600;
		margin-bottom: 4px;
		letter-spacing: 0.5px;
	}

	.guide-desc {
		font-size: 10px;
		color: #777;
		margin-bottom: 6px;
	}

	.guide-section pre {
		background: #040404;
		border: 1px solid #181818;
		padding: 8px;
		overflow-x: auto;
		font-size: 10px;
		line-height: 1.5;
	}

	.guide-section code {
		color: #999;
		font-family: 'JetBrains Mono', monospace;
	}

	.guide-list {
		list-style: none;
	}

	.guide-list li {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 10px;
		color: #888;
		padding: 1px 0;
	}

	.guide-list :global(strong) {
		color: #bbb;
		font-weight: 600;
	}

	.bullet {
		color: #7aa2d4;
		font-weight: 700;
		flex-shrink: 0;
	}

	.check {
		color: #7ab87a;
		font-weight: 700;
		flex-shrink: 0;
	}

	.toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%) translateY(80px);
		background: #111;
		border: 1px solid #2a2a2a;
		color: #d0d0d0;
		padding: 8px 16px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		font-weight: 500;
		opacity: 0;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 200;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.toast.show {
		transform: translateX(-50%) translateY(0);
		opacity: 1;
	}

	.toast-check {
		color: #7ab87a;
		font-weight: 700;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.container {
			padding: 14px 10px;
		}

		.toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}

		.toggles {
			gap: 10px;
		}

		.hide-mobile {
			display: none;
		}

		.stats {
			grid-template-columns: 1fr;
		}
	}

	@media (min-width: 769px) {
		.container {
			padding: 28px 24px;
		}
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 12px;
	}
	.tab {
		background: transparent;
		border: 1px solid #1e1e1e;
		color: #777;
		padding: 6px 18px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		letter-spacing: 2px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.tab:hover {
		color: #aaa;
		border-color: #2a2a2a;
	}
	.tab.active {
		color: #7aa2d4;
		border-color: #4a7ab5;
		background: #0c0e12;
	}

	.snippet-bar {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.btn-ghost {
		background: transparent;
		border: 1px solid #2a2a2a;
		color: #999;
		padding: 4px 12px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 1px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.btn-ghost:hover {
		background: #111;
		border-color: #4a7ab5;
		color: #d0d0d0;
	}

	.meter-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}
	.meter-count {
		font-size: 10px;
		letter-spacing: 1px;
		color: #888;
	}
	.meter-count.ok { color: #7ab87a; }
	.meter-count.warn { color: #d4a24a; }
	.meter-count.over { color: #e06060; }
	.meter-bar {
		height: 4px;
		background: #0e0e0e;
		border: 1px solid #1e1e1e;
		overflow: hidden;
	}
	.meter-fill {
		height: 100%;
		transition: width 0.3s ease, background 0.3s;
	}
	.meter-fill.ok { background: #7ab87a; }
	.meter-fill.warn { background: #d4a24a; }
	.meter-fill.over { background: #e06060; }

	.warnings {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
	}
	.warning {
		font-size: 10px;
		color: #d4a24a;
		background: #100c06;
		border-left: 2px solid #d4a24a;
		padding: 8px 10px;
		line-height: 1.5;
	}
	.warn-icon {
		font-weight: 700;
		margin-right: 4px;
	}

	.output-actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.textarea-lg {
		min-height: 120px;
		resize: vertical;
		line-height: 1.6;
	}
	.decode-output {
		white-space: pre-wrap;
		word-break: normal;
		max-height: 240px;
	}

	.lib-block {
		margin-bottom: 18px;
	}
	.lib-block:last-child {
		margin-bottom: 0;
	}
	.lib-block h4 {
		font-size: 11px;
		color: #ccc;
		font-weight: 600;
		margin-bottom: 8px;
		letter-spacing: 0.5px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		background: #070707;
		border: 1px solid #1e1e1e;
		color: #999;
		padding: 4px 10px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.chip:hover {
		border-color: #4a7ab5;
		color: #7aa2d4;
		background: #0c0e12;
	}
	.snip-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.snip-row {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #070707;
		border: 1px solid #1e1e1e;
		transition: border-color 0.2s;
	}
	.snip-row:hover {
		border-color: #2a2a2a;
	}
	.snip-name {
		flex: 1;
		min-width: 0;
		text-align: left;
		background: transparent;
		border: none;
		color: #bbb;
		padding: 7px 10px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.snip-name:hover {
		color: #7aa2d4;
	}
	.icon-btn {
		background: transparent;
		border: none;
		color: #555;
		font-size: 15px;
		line-height: 1;
		padding: 6px 10px;
		cursor: pointer;
		transition: color 0.2s;
	}
	.icon-btn:hover {
		color: #e06060;
	}
	.empty {
		font-size: 10px;
		color: #666;
		line-height: 1.6;
	}

	.site-footer {
		margin-top: 40px;
		padding-top: 16px;
		border-top: 1px solid #1e1e1e;
		text-align: center;
		font-size: 10px;
		letter-spacing: 1px;
		color: #555;
	}
	.site-footer a {
		color: #777;
		text-decoration: none;
		transition: color 0.2s;
	}
	.site-footer a:hover {
		color: #7aa2d4;
	}
	.site-footer .sep {
		margin: 0 8px;
		color: #333;
	}
</style>
