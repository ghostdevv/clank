import { Loader, Text } from '@mariozechner/pi-tui';
import { randomSpinner } from '../../spinners';
import { generate } from '../../generate';
import { styleText } from 'node:util';
import dedent from 'dedent';
import {
	type SessionMessageEntry,
	type ExtensionContext,
	type SessionEntry,
	type ExtensionAPI,
} from '@mariozechner/pi-coding-agent';

const SESSION_NAME_ENTRY_TYPE = 'clank::session-name';
const STATUS_WIDGET_ID = 'clank::session-name-status';

class StatusIndicator {
	private loader: Loader | null = null;
	private running = false;

	constructor(private readonly ctx: ExtensionContext) {}

	start() {
		if (this.running) return;
		this.running = true;

		this.ctx.ui.setWidget(STATUS_WIDGET_ID, (tui) => {
			const spinner = randomSpinner();

			this.loader ??= new Loader(
				tui,
				(str) => this.ctx.ui.theme.fg('muted', str),
				(str) => this.ctx.ui.theme.fg('muted', str),
				"Namin'",
				{ frames: spinner.frames, intervalMs: spinner.interval },
			);

			this.loader.start();
			return this.loader;
		});
	}

	stop() {
		this.ctx.ui.setWidget(STATUS_WIDGET_ID, undefined);
		this.loader?.stop();
	}

	[Symbol.dispose]() {
		this.stop();
		this.loader = null;
	}
}

interface NameEntryData {
	name: string;
	model?: string;
}

function appendSessionNameMessage(pi: ExtensionAPI, details: NameEntryData) {
	pi.sendMessage({
		customType: SESSION_NAME_ENTRY_TYPE,
		content: `Session name changed to ${details.name}`,
		display: true,
		details,
	});
}

function hasSessionNameEntry(entries: SessionEntry[]) {
	return entries.some((e) => {
		if (e.type === 'custom' && e.customType === SESSION_NAME_ENTRY_TYPE) {
			return true;
		}

		if (
			e.type === 'custom_message' &&
			e.customType === SESSION_NAME_ENTRY_TYPE
		) {
			return true;
		}

		return false;
	});
}

const MODEL_ID = 'local/gemma-4-E4B-it';

/**
 * Find the model to use for session name generation.
 */
function findModel(ctx: ExtensionContext) {
	const [provider, modelId] = MODEL_ID.split('/');

	if (provider && modelId) {
		// oxlint-disable-next-line unicorn/no-array-method-this-argument: false positive
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

	using status = new StatusIndicator(ctx);
	status.start();

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

	appendSessionNameMessage(pi, {
		name,
		model: `${model.provider}/${model.name}`,
	});

	status.stop();
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.registerMessageRenderer<NameEntryData>(
		SESSION_NAME_ENTRY_TYPE,
		(message, _options, theme) => {
			const nameText = message.details?.name
				? styleText('bold', message.details.name)
				: theme.fg('error', '(unknown)');

			const text = `🏷  Session name changed to ${nameText}`;
			return new Text(styleText('dim', text), 1, 1);
		},
	);

	let generating = false;

	pi.on('message_start', (_event, ctx) => {
		if (ctx.sessionManager.getSessionName()) return;

		const entries = ctx.sessionManager.getEntries();

		if (hasSessionNameEntry(entries) || generating) {
			return;
		}

		generating = true;
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
				appendSessionNameMessage(pi, { name });
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
			generateSessionName(
				pi,
				ctx,
				ctx.sessionManager.getEntries(),
			).finally(() => (generating = false));
		},
	});
};
