import { homedir } from 'node:os';
import type {
	ReadonlyFooterDataProvider,
	ExtensionContext,
	ExtensionAPI,
} from '@mariozechner/pi-coding-agent';
import {
	truncateToWidth,
	type Component,
	visibleWidth,
} from '@mariozechner/pi-tui';

const numberIntl = new Intl.NumberFormat();

function fmt(number?: number | null, variant: 'n' | 'u' | 'p' = 'n') {
	if (variant === 'u' && number) {
		const len = (Math.log(number) * Math.LOG10E + 1) | 0;
		if (len < 4) return number.toFixed(1);
		return `${(number / 1000).toFixed(1)}k`;
	}

	return typeof number === 'number' && !Number.isNaN(number)
		? `${numberIntl.format(number)}${variant === 'p' ? '%' : ''}`
		: '?';
}

function prettifyPath(cwd: string) {
	const home = homedir();
	return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

function getUsage(ctx: ExtensionContext) {
	let input = 0;
	let output = 0;
	let cost = 0;

	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === 'message' && entry.message.role === 'assistant') {
			input += entry.message.usage.input;
			output += entry.message.usage.output;
			cost += entry.message.usage.cost.total;
		}
	}

	const usage = ctx.getContextUsage();
	usage?.tokens;

	return {
		input,
		output,
		cost,
		ctxSize: usage?.contextWindow,
		ctxUsed: usage?.tokens,
		ctxPercent: usage?.percent,
	};
}

class Footer implements Component {
	constructor(
		private readonly data: ReadonlyFooterDataProvider,
		private readonly ctx: ExtensionContext,
	) {}

	invalidate() {}

	render(width: number): string[] {
		const cwd = prettifyPath(this.ctx.sessionManager.getCwd());
		const branch = this.data.getGitBranch();
		const usage = getUsage(this.ctx);
		const theme = this.ctx.ui.theme;
		const model = this.ctx.model;

		const left = `${cwd}${branch ? `:${branch}` : ''}`;
		let right = '';

		right += theme.fg(
			usage.ctxPercent && usage.ctxPercent >= 90
				? 'error'
				: usage.ctxPercent && usage.ctxPercent >= 80
					? 'warning'
					: 'dim',
			` ${fmt(usage.ctxPercent, 'p')}${usage.ctxSize ? ` (${fmt(usage.ctxSize)})` : ''}`,
		);

		right += theme.fg('dim', ' ·');

		if (usage.input) {
			right += theme.fg('dim', ` ⭡${fmt(usage.input, 'u')}`);
		}

		if (usage.output) {
			right += theme.fg('dim', ` ⭣${fmt(usage.output, 'u')}`);
		}

		if (usage.cost) {
			const sub = model && this.ctx.modelRegistry.isUsingOAuth(model);
			// prettier-ignore
			right += theme.fg('dim', ` $${fmt(usage.cost)}${sub ? ' (sub)' : ''}`);
		}

		const ellipsis = theme.fg('dim', '...');
		const lines: string[] = [];

		const remaining = width - (visibleWidth(left) + visibleWidth(right));
		const joined = `${left}${remaining > 0 ? ' '.repeat(remaining) : ' '}${right}`;
		lines.push(theme.fg('dim', truncateToWidth(joined, width, ellipsis)));

		const statuses = this.data
			.getExtensionStatuses()
			.entries()
			.toArray()
			.toSorted(([a], [b]) => a.localeCompare(b))
			.map(([, text]) => text.replaceAll(/[\n\r\t]| +/g, ' ').trim())
			.join(' ')
			.trim();

		if (statuses.length) {
			lines.push(truncateToWidth(statuses, width, ellipsis));
		}

		lines.unshift(' '.repeat(width));

		return lines;
	}
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_start', (_event, ctx) => {
		ctx.ui.setFooter((_tui, _theme, data) => new Footer(data, ctx));
	});
};
