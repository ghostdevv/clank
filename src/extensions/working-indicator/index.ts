import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { SPINNERS } from './spinners';

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('turn_start', (_event, ctx) => {
		const spinner = SPINNERS[Math.floor(Math.random() * SPINNERS.length)];

		ctx.ui.setWorkingMessage(spinner.word);

		ctx.ui.setWorkingIndicator({
			intervalMs: spinner.interval,
			frames: spinner.frames.map((s) => ctx.ui.theme.fg('accent', s)),
		});
	});
};
