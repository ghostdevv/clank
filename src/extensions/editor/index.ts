import { paintBackground } from '../better-box';
import { stripVTControlCharacters, styleText } from 'node:util';
import {
	type KeybindingsManager,
	type ExtensionContext,
	type ExtensionAPI,
	CustomEditor,
} from '@mariozechner/pi-coding-agent';
import {
	type EditorOptions,
	type EditorTheme,
	getKeybindings,
	type TUI,
} from '@mariozechner/pi-tui';

class Editor extends CustomEditor {
	constructor(
		private readonly ctx: ExtensionContext,
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		options?: EditorOptions,
	) {
		super(tui, theme, keybindings, options);
	}

	handleInput(data: string) {
		const isSubmitKey = getKeybindings().matches(data, 'tui.input.submit');

		// hack because we can't override in built commands
		// not ideal, also we can't change description afaik
		if (isSubmitKey && this.getText().startsWith('/name')) {
			const name = this.ctx.sessionManager.getSessionName();
			this.ctx.ui.notify(
				name
					? `The session is called ${styleText('bold', name)}`
					: `The session is unnamed`,
			);

			this.setText('');
			this.tui.requestRender();
			return;
		}

		super.handleInput(data);
	}

	render(width: number): string[] {
		if (this.getPaddingX() !== 2) {
			this.setPaddingX(2);
		}

		const theme = this.ctx.ui.theme;
		const leftBar = theme.fg('accent', '┃');

		const model = this.ctx.model?.name
			? this.ctx.model.name
			: theme.fg('warning', '(no model)');

		const provider = this.ctx.model?.provider
			? ` ${theme.fg('dim', this.ctx.model.provider)}`
			: '';

		return super
			.render(width)
			.toSpliced(-1, 0, '')
			.toSpliced(-1, 0, `  ${model}${provider}`)
			.map((line, index, lines) => {
				if (index === 0 || index === lines.length - 1) {
					line = line.replaceAll('─', ' ');
				}

				const target = stripVTControlCharacters(line)[0];
				return `${leftBar}${paintBackground(line.replace(target, ''), width - 1, theme)}`;
			});
	}
}

// oxlint-disable-next-line import/no-anonymous-default-export
export default (pi: ExtensionAPI) => {
	pi.on('session_start', (_event, ctx) => {
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			return new Editor(ctx, tui, theme, keybindings);
		});
	});
};
