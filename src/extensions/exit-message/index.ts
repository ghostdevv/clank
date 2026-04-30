import { styleText } from 'node:util';
import { existsSync } from 'node:fs';
import { LOGO } from '../../logo';
import dedent from 'dedent';
import type {
	ExtensionContext,
	ExtensionAPI,
} from '@mariozechner/pi-coding-agent';

function exitMessage(ctx: ExtensionContext) {
	const name = ctx.sessionManager.getSessionName();
	const id = ctx.sessionManager.getSessionId();
	const theme = ctx.ui.theme;

	return dedent`
        ${LOGO}

        ${styleText('bold', theme.fg('accent', 'Session'))}    ${name ?? theme.fg('dim', '(unnamed)')}
        ${styleText('bold', theme.fg('accent', 'Continue'))}   clank --session ${id}
    `;
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_shutdown', (event, ctx) => {
		if (event.reason === 'quit') {
			const sessionFile = ctx.sessionManager.getSessionFile();

			// "Clear" terminal without clearing scrollback
			process.stdout.write(`${'\n'.repeat(process.stdout.rows)}\u001B[H`);

			// Print exit message if the session isn't empty
			if (sessionFile && existsSync(sessionFile)) {
				console.log(`\n${exitMessage(ctx)}\n`);
			}
		}
	});
};
