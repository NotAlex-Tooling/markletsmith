<!-- CodeMirror 6 JavaScript editor with monochrome dark theme and syntax highlighting -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { javascript } from '@codemirror/lang-javascript';
	import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
	import { bracketMatching, foldGutter, indentOnInput, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
	import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
	import { tags } from '@lezer/highlight';

	let { value = $bindable('') }: { value: string } = $props();

	let editorContainer: HTMLDivElement;
	let view = $state<EditorView | undefined>(undefined);

	const monoTheme = EditorView.theme({
		'&': {
			backgroundColor: '#0a0a0a',
			color: '#e0e0e0',
			fontSize: '13px',
			fontFamily: "'JetBrains Mono', monospace",
			height: '360px',
			border: '1px solid #333',
			borderRadius: '4px'
		},
		'&.cm-focused': {
			outline: '1px solid #666'
		},
		'.cm-content': {
			caretColor: '#fff',
			fontFamily: "'JetBrains Mono', monospace",
			padding: '8px 0'
		},
		'.cm-cursor, .cm-dropCursor': {
			borderLeftColor: '#fff',
			borderLeftWidth: '2px'
		},
		'.cm-selectionBackground, ::selection': {
			backgroundColor: '#333 !important'
		},
		'.cm-activeLine': {
			backgroundColor: '#111'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#111'
		},
		'.cm-gutters': {
			backgroundColor: '#080808',
			color: '#555',
			border: 'none',
			borderRight: '1px solid #222'
		},
		'.cm-lineNumbers .cm-gutterElement': {
			fontFamily: "'JetBrains Mono', monospace",
			fontSize: '11px'
		},
		'.cm-foldGutter': {
			color: '#444'
		},
		'.cm-matchingBracket': {
			backgroundColor: 'transparent',
			color: '#fff !important',
			outline: '1px solid #666'
		},
		'.cm-selectionMatch': {
			backgroundColor: '#2a2a2a'
		},
		'&.cm-focused .cm-selectionBackground': {
			backgroundColor: '#333'
		},
		'.cm-panels': {
			backgroundColor: '#111',
			color: '#ccc'
		},
		'.cm-panels.cm-panels-top': {
			borderBottom: '1px solid #333'
		},
		'.cm-searchMatch': {
			backgroundColor: '#333',
			outline: '1px solid #555'
		},
		'.cm-searchMatch.cm-searchMatch-selected': {
			backgroundColor: '#444'
		},
		'.cm-tooltip': {
			backgroundColor: '#111',
			border: '1px solid #333',
			color: '#ccc'
		},
		'.cm-tooltip-autocomplete': {
			'& > ul > li[aria-selected]': {
				backgroundColor: '#222'
			}
		}
	}, { dark: true });

	const monoHighlight = HighlightStyle.define([
		{ tag: tags.keyword, color: '#fff', fontWeight: 'bold' },
		{ tag: tags.operator, color: '#aaa' },
		{ tag: tags.special(tags.variableName), color: '#ccc' },
		{ tag: tags.typeName, color: '#ddd', fontStyle: 'italic' },
		{ tag: tags.atom, color: '#fff' },
		{ tag: tags.number, color: '#bbb' },
		{ tag: tags.definition(tags.variableName), color: '#fff' },
		{ tag: tags.string, color: '#999' },
		{ tag: tags.special(tags.string), color: '#888' },
		{ tag: tags.comment, color: '#555', fontStyle: 'italic' },
		{ tag: tags.variableName, color: '#ccc' },
		{ tag: tags.tagName, color: '#ddd' },
		{ tag: tags.bracket, color: '#888' },
		{ tag: tags.meta, color: '#777' },
		{ tag: tags.link, color: '#aaa', textDecoration: 'underline' },
		{ tag: tags.heading, color: '#fff', fontWeight: 'bold' },
		{ tag: tags.emphasis, fontStyle: 'italic' },
		{ tag: tags.strong, fontWeight: 'bold' },
		{ tag: tags.strikethrough, textDecoration: 'line-through' },
		{ tag: tags.className, color: '#ddd' },
		{ tag: tags.propertyName, color: '#bbb' },
		{ tag: [tags.function(tags.variableName)], color: '#eee' },
		{ tag: tags.bool, color: '#fff', fontWeight: 'bold' },
		{ tag: tags.null, color: '#888' },
		{ tag: tags.punctuation, color: '#666' },
		{ tag: tags.regexp, color: '#aaa' },
	]);

	// Creates the CodeMirror editor with extensions, theme, and two-way value binding.
	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				history(),
				foldGutter(),
				drawSelection(),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				highlightSelectionMatches(),
				keymap.of([
					...closeBracketsKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					indentWithTab
				]),
				javascript(),
				monoTheme,
				syntaxHighlighting(monoHighlight),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						value = update.state.doc.toString();
					}
				}),
				EditorState.tabSize.of(2),
				EditorView.lineWrapping
			]
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});
	});

	// Syncs external value changes (snippet load, template insert, decode import) into the editor document.
	$effect(() => {
		const next = value;
		if (view && next !== view.state.doc.toString()) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
		}
	});

	// Destroys the editor instance to free resources.
	onDestroy(() => {
		view?.destroy();
	});
</script>

<div bind:this={editorContainer} class="editor-wrap"></div>

<style>
	.editor-wrap {
		width: 100%;
		overflow: hidden;
		border-radius: 4px;
	}
	.editor-wrap :global(.cm-editor) {
		border-radius: 4px;
	}
</style>
