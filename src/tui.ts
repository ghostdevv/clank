import type { Theme } from '@mariozechner/pi-coding-agent';
import { Text } from '@mariozechner/pi-tui';

const MAX_LINES = 8;

export class ExpandableText extends Text {
	constructor(
		public readonly expanded: boolean,
		text: string,
		private theme: Theme,
	) {
		super(text, 0, 0);
	}

	render(width: number) {
		const lines = super.render(width);
		if (this.expanded || lines.length < MAX_LINES) return lines;

		return [
			...lines.slice(0, MAX_LINES),
			this.theme.fg(
				'dim',
				`... (${lines.length - MAX_LINES} more lines, ctrl+o to expand)`,
			),
		];
	}
}
