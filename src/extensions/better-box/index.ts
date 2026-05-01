import { Box, visibleWidth } from '@mariozechner/pi-tui';
import type {
	ExtensionContext,
	ExtensionAPI,
	Theme,
} from '@mariozechner/pi-coding-agent';

function paintBackground(line: string, width: number, theme: Theme) {
	const visLen = visibleWidth(line);
	const padNeeded = Math.max(0, width - visLen);
	const padded = line + ' '.repeat(padNeeded);
	return theme.bg('selectedBg', padded);
}

export function patchBox(theme: Theme) {
	// oxlint-disable-next-line unicorn/consistent-function-scoping
	Box.prototype.render = function render(width) {
		// @ts-expect-error private property
		// oxlint-disable-next-line typescript/no-unsafe-assignment
		const paddingX: number = this.paddingX;

		// @ts-expect-error private property
		// oxlint-disable-next-line typescript/no-unsafe-assignment
		const paddingY: number = this.paddingY;

		// @ts-expect-error private property
		// oxlint-disable-next-line typescript/no-unsafe-assignment
		const paintAccent: ((text: string) => string) | undefined = this.bgFn;

		const leftBar = paintAccent
			? paintAccent('┃').replace('48;2;', '38;2;')
			: theme.bg('customMessageBg', '┃').replace('48;2;', '38;2;');

		// Full width after leftBar is painted
		const boxWidth = Math.max(0, width - 1);

		// Full box width minus internal padding to left and right
		const contentWidth = Math.max(1, boxWidth - paddingX * 2);

		// prettier-ignore
		const lines = this.children.flatMap((child) => child.render(contentWidth));
		if (!lines.length) return [];

		// @ts-expect-error private property
		// oxlint-disable-next-line typescript/no-unsafe-call
		if (this.matchCache(width, lines, leftBar)) {
			// @ts-expect-error private property
			// oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access
			return this.cache!.lines;
		}

		const output: string[] = [];

		for (let i = 0; i < paddingY; i++) {
			output.push(leftBar + paintBackground('', boxWidth, theme));
		}

		for (const line of lines) {
			output.push(leftBar + paintBackground(` ${line}`, boxWidth, theme));
		}

		for (let i = 0; i < paddingY; i++) {
			output.push(leftBar + paintBackground('', boxWidth, theme));
		}

		// @ts-expect-error private property
		this.cache = {
			childLines: lines,
			width,
			bgSample: leftBar,
			lines: output,
		};

		return output;
	};
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_start', (event, ctx: ExtensionContext) => {
		if (event.reason === 'startup' && ctx.hasUI) {
			patchBox(ctx.ui.theme);
		}
	});
};
