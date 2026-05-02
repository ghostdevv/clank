import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.registerCommand('id', {
		description: 'Return the session id',
		async handler(_args, ctx) {
			ctx.ui.notify(
				`Session id: ${ctx.sessionManager.getSessionId()}`,
				'info',
			);
		},
	});
};
