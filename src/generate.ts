import type { ExtensionContext } from '@mariozechner/pi-coding-agent';
import {
	type Message,
	type Model,
	complete,
	type Api,
} from '@mariozechner/pi-ai';

export async function generate<T extends Api>(
	ctx: ExtensionContext,
	model: Model<T>,
	prompt: string,
): Promise<string | null> {
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok || !auth.apiKey) return null;

	const messages: Message[] = [
		{
			role: 'user',
			content: [{ type: 'text', text: prompt }],
			timestamp: Date.now(),
		},
	];

	try {
		const response = await complete(
			model,
			{ messages },
			{
				apiKey: auth.apiKey,
				headers: auth.headers,
			},
		);

		const textContent = response.content.find((c) => c.type === 'text');

		if (textContent && 'text' in textContent) {
			return textContent.text.trim();
		}

		return null;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Generation failed: ${message}`, 'warning');
		return null;
	}
}
