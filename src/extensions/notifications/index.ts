import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('agent_end', () => {
		process.stdout.write('\u0007');
	});
};
