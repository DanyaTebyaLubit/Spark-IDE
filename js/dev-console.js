// ============================================================
//  Консоль Разработчика
// ============================================================

function initConsoleUI() {
	const previewCol = document.getElementById('previewCol')
	if (!previewCol || document.getElementById('sparkConsolePanel')) return

	const style = document.createElement('style')
	style.textContent = `
		.console-panel {
			height: 180px;
			background: var(--panel-3, #101218);
			border-top: 1px solid var(--edge, #24272f);
			display: flex;
			flex-direction: column;
			font-family: var(--mono, monospace);
			font-size: 12px;
			flex-shrink: 0;
		}
		.console-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 6px 14px;
			background: var(--panel, #14161c);
			border-bottom: 1px solid var(--edge, #24272f);
			color: var(--dim, #7d8190);
			font-weight: 600;
			font-size: 11px;
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}
		.console-header span {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.console-header button {
			background: transparent;
			border: none;
			color: var(--dim, #7d8190);
			padding: 2px 6px;
			cursor: pointer;
			border-radius: 4px;
			font-size: 11px;
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.console-header button:hover {
			color: var(--text, #e8e9f0);
			background: var(--edge, #24272f);
		}
		.console-logs {
			flex: 1;
			overflow-y: auto;
			padding: 8px 12px;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.console-line {
			white-space: pre-wrap;
			word-break: break-all;
			line-height: 1.4;
			font-size: 12px;
			padding: 2px 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.03);
		}
		.console-line.log { color: var(--text, #e8e9f0); }
		.console-line.warn { color: #facc15; }
		.console-line.error { color: #ff5c6c; }
	`
	document.head.appendChild(style)

	const consolePanel = document.createElement('div')
	consolePanel.id = 'sparkConsolePanel'
	consolePanel.className = 'console-panel'
	consolePanel.innerHTML = `
		<div class="console-header">
			<span><i class="ri-terminal-box-line"></i> Консоль разработчика</span>
			<button id="clearConsoleBtn" title="Очистить лог"><i class="ri-delete-bin-line"></i> Очистить</button>
		</div>
		<div id="consoleLogsContainer" class="console-logs"></div>
	`
	previewCol.appendChild(consolePanel)

	document
		.getElementById('clearConsoleBtn')
		.addEventListener('click', clearConsole)

	window.addEventListener('message', e => {
		if (e.data && e.data.type === 'spark-console') {
			appendConsoleLog(e.data.level, e.data.args)
		}
	})
}

function clearConsole() {
	const container = document.getElementById('consoleLogsContainer')
	if (container) container.innerHTML = ''
}

function appendConsoleLog(level, args) {
	const container = document.getElementById('consoleLogsContainer')
	if (!container) return
	const line = document.createElement('div')
	line.className = `console-line ${level}`
	const timestamp = new Date().toLocaleTimeString()
	line.textContent = `[${timestamp}] ${args.join(' ')}`
	container.appendChild(line)
	container.scrollTop = container.scrollHeight
}

