import { getKeybindings } from '@mariozechner/pi-tui';
import { generate } from '../../generate';
import { styleText } from 'node:util';
import dedent from 'dedent';
import {
	type SessionMessageEntry,
	type ExtensionContext,
	type SessionEntry,
	type ExtensionAPI,
	CustomEditor,
} from '@mariozechner/pi-coding-agent';

const NAME_SESSION_ENTRY_TYPE = 'clank::session-name';

interface NameEntryData {
	name: string;
	model?: string;
}

const MODEL_ID = 'local/gemma-4-E4B-it';

// Hack to override the default /name command
// Not ideal and doesn't change the description :/
class Editor extends CustomEditor {
	public onNameCommand?: () => void;

	handleInput(data: string) {
		const isSubmitKey = getKeybindings().matches(data, 'tui.input.submit');
		if (isSubmitKey && this.getText().startsWith('/name')) {
			this.setText('');
			this.onNameCommand?.();
			this.tui.requestRender();
			return;
		}

		super.handleInput(data);
	}
}

/**
 * Find the model to use for session name generation.
 */
function findModel(ctx: ExtensionContext) {
	const [provider, modelId] = MODEL_ID.split('/');

	if (provider && modelId) {
		const model = ctx.modelRegistry.find(provider, modelId);
		if (model) return model;
	}

	const model = ctx.model;
	if (model) return model;

	ctx.ui.notify(
		'No session name model found, skipping generation',
		'warning',
	);

	return null;
}

/**
 * Find the first user message entry in the session history.
 */
function findFirstMessage(entries: SessionEntry[]) {
	const messageEntry = entries.find(
		(e): e is SessionMessageEntry =>
			e.type === 'message' && e.message.role === 'user',
	);

	if (messageEntry?.message.role !== 'user') {
		return null;
	}

	if (typeof messageEntry.message.content === 'string') {
		return messageEntry.message.content;
	}

	return messageEntry.message.content.reduce(
		(text, part) => (part.type === 'text' ? text + part.text : text),
		'',
	);
}

async function generateSessionName(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	entries: SessionEntry[],
) {
	const model = findModel(ctx);
	if (!model) return;

	const message = findFirstMessage(entries);
	if (!message) return;

	const prompt = dedent`
        You are Clank, built-on Pi, and your task is to generate a short descriptive
        session name (max 50 characters) that captures the main topic or task. Use the
        following opening user message as context. Return only the session name, no
        explanation or quotes.

        ### User Message

        ${message}
    `;

	const name = await generate(ctx, model, prompt);
	if (!name) return;

	pi.setSessionName(name);

	pi.appendEntry<NameEntryData>(NAME_SESSION_ENTRY_TYPE, {
		model: `${model.provider}/${model.name}`,
		name: name,
	});

	ctx.ui.notify(`Session renamed to ${name}`, 'info');
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_start', (_event, ctx) => {
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = new Editor(tui, theme, keybindings);
			editor.onNameCommand = () => {
				const name = ctx.sessionManager.getSessionName();

				ctx.ui.notify(
					name
						? `The session is called ${styleText('bold', name)}`
						: `The session is unnamed`,
				);
			};

			return editor;
		});
	});

	let generating = false;

	pi.on('message_start', (_event, ctx) => {
		if (ctx.sessionManager.getSessionName()) return;

		const entries = ctx.sessionManager.getEntries();

		const sessionEntryExists = entries.some(
			(e) =>
				e.type === 'custom' && e.customType === NAME_SESSION_ENTRY_TYPE,
		);

		if (sessionEntryExists || generating) {
			return;
		}

		generating = true;
		// oxlint-disable-next-line promise/catch-or-return, typescript/no-floating-promises, promise/prefer-await-to-then
		generateSessionName(pi, ctx, entries).finally(
			() => (generating = false),
		);
	});

	pi.registerCommand('rename', {
		description: 'Set or generate the session name',
		async handler(args, ctx) {
			const name = args.trim();

			if (name) {
				pi.setSessionName(name);
				// prettier-ignore
				pi.appendEntry<NameEntryData>(NAME_SESSION_ENTRY_TYPE, {name});
				ctx.ui.notify(`Session renamed to ${name}`, 'info');
				return;
			}

			if (generating) {
				ctx.ui.notify(
					'Session name is already being generated...',
					'info',
				);

				return;
			}

			generating = true;
			await generateSessionName(pi, ctx, ctx.sessionManager.getEntries());
			generating = false;
		},
	});
};
