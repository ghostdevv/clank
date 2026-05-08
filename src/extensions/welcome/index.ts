import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
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
		if (ctx.hasUI) {
			ctx.ui.setHeader(() => new Text(MESSAGE));
		}
	});
};
