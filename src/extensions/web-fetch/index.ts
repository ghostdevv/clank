import { NodeHtmlMarkdown } from 'node-html-markdown';
import { ExpandableText } from '../../tui';
import { Type } from 'typebox';
import {
	type AgentToolResult,
	type ExtensionAPI,
	defineTool,
} from '@mariozechner/pi-coding-agent';

type TextType = 'text' | 'markdown' | 'json';

interface WebFetchResult {
	status: number;
	contentType: string | null;
	textType: TextType;
	finalUrl: string;
}

function respond(
	response: Response,
	textType: TextType,
	text: string,
): AgentToolResult<WebFetchResult> {
	return {
		content: [{ type: 'text', text }],
		details: {
			contentType: response.headers.get('content-type'),
			status: response.status,
			finalUrl: response.url,
			textType,
		},
	};
}

const params = Type.Object({
	url: Type.String({
		description:
			'Absolute http(s) URL to fetch with an unconditional GET request.',
	}),
});

const webFetchTool = defineTool<typeof params, WebFetchResult>({
	name: 'web_fetch',
	label: 'Web Fetch',
	description: 'Fetch a url and return the body as usable text',
	promptSnippet: 'Fetch a url and return the body as usable text',
	executionMode: 'parallel',
	parameters: params,
	renderResult(result, options, theme) {
		let text = result.content
			.filter((c) => c.type === 'text')
			.reduce((text, c) => text + c.text, '')
			.trim();

		// oxlint-disable-next-line typescript/switch-exhaustiveness-check
		switch (result.details.textType) {
			case 'json':
				const formatted = JSON.stringify(JSON.parse(text), null, 2);
				text = `\n${theme.fg('dim', formatted)}`;
				break;

			default:
				text = `\n${text}`;
		}

		return new ExpandableText(options.expanded, text, theme);
	},
	async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
		const parsed = URL.parse(params.url);

		if (!parsed) {
			throw new Error('Invalid URL.');
		}

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('Only http and https URLs are allowed.');
		}

		const response = await fetch(parsed, {
			method: 'GET',
			signal,
		});

		const contentType = response.headers
			.get('content-type')
			?.split(';')
			.at(0)
			?.trim();

		// oxlint-disable-next-line typescript/switch-exhaustiveness-check false positive
		switch (contentType) {
			case 'text/html': {
				const body = await response.text();
				const md = NodeHtmlMarkdown.translate(body);
				return respond(response, 'markdown', md);
			}

			case 'application/json': {
				const body = await response.json();
				return respond(response, 'json', JSON.stringify(body));
			}

			case 'text/plain':
			case 'text/markdown': {
				const body = await response.text();
				return respond(response, 'text', body);
			}

			default:
				throw new Error(`Unsupported content type: ${contentType}`);
		}
	},
});

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.registerTool(webFetchTool);
};
