import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { styleText } from 'node:util';
import { LOGO } from '../../logo';
import dedent from 'dedent';

const MESSAGE = dedent`
    ${LOGO}

    ${styleText('dim', 'Welcome to clank.pi :)')}
`;

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_start', (event, ctx) => {
		if (event.reason === 'startup' && ctx.hasUI) {
			ctx.ui.setHeader(() => ({
				render: () => [MESSAGE],
				// oxlint-disable-next-line no-empty-function
				invalidate: () => {},
			}));
		}
	});
};
