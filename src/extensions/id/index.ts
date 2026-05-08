import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.registerCommand('id', {
		description: 'Return the session id',
		// oxlint-disable-next-line typescript/require-await
		async handler(_args, ctx) {
			ctx.ui.notify(
				`Session id: ${ctx.sessionManager.getSessionId()}`,
				'info',
			);
		},
	});
};
