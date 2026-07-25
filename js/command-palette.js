// ============================================================
//  Палитра команд (Ctrl+Shift+P)
// ============================================================

function closeAllTabs() {
	openTabs = []
	activeTabId = null
	renderTabs()
	renderTree()
	syncEditor()
	saveProjectToStorage()
}

function getCommands() {
	return [
		{
			label: 'Запустить проект',
			icon: 'ri-play-fill',
			shortcut: 'Ctrl+S',
			action: run,
		},
		{
			label: 'Форматировать документ',
			icon: 'ri-magic-line',
			shortcut: 'Shift+Alt+F',
			action: formatCurrentFile,
		},
		{
			label: 'Новый файл',
			icon: 'ri-file-add-line',
			action: () => createFile(),
		},
		{
			label: 'Новая папка',
			icon: 'ri-folder-add-line',
			action: () => createFolder(),
		},
		{
			label: 'Переключить боковую панель',
			icon: 'ri-side-bar-line',
			shortcut: 'Ctrl+B',
			action: () =>
				document.getElementById('sidebar').classList.toggle('collapsed'),
		},
		{
			label: 'Переключить предпросмотр',
			icon: 'ri-layout-right-line',
			shortcut: 'Ctrl+/',
			action: () =>
				document.getElementById('mainGrid').classList.toggle('no-preview'),
		},
		{
			label: 'Сменить тему',
			icon: 'ri-sun-line',
			action: () => document.getElementById('themeToggle').click(),
		},
		{
			label: 'Скачать сайт (html+css+js)',
			icon: 'ri-global-line',
			action: exportCompiledSite,
		},
		{
			label: 'Сохранить проект (.zip)',
			icon: 'ri-folder-zip-line',
			action: exportProjectZip,
		},
		{
			label: 'Открыть проект из ZIP',
			icon: 'ri-folder-open-line',
			action: () => document.getElementById('importProjectInput').click(),
		},
		{
			label: 'Поиск по проекту',
			icon: 'ri-search-line',
			shortcut: 'Ctrl+Shift+F',
			action: openGlobalSearch,
		},
		{
			label: 'Открыть ИИ-помощника',
			icon: 'ri-sparkling-2-line',
			shortcut: 'Ctrl+Shift+A',
			action: () => openAiAssistant(),
		},
		{
			label: 'Экспортировать диалог с ИИ (.md)',
			icon: 'ri-download-2-line',
			action: aiExportChat,
		},
		{
			label: 'Найти в файле',
			icon: 'ri-search-2-line',
			shortcut: 'Ctrl+F',
			action: () => openFindPanel(false),
		},
		{
			label: 'Найти и заменить',
			icon: 'ri-find-replace-line',
			shortcut: 'Ctrl+H',
			action: () => openFindPanel(true),
		},
		{
			label: 'Увеличить размер шрифта',
			icon: 'ri-zoom-in-line',
			shortcut: 'Ctrl+=',
			action: () => zoomEditor(1),
		},
		{
			label: 'Уменьшить размер шрифта',
			icon: 'ri-zoom-out-line',
			shortcut: 'Ctrl+-',
			action: () => zoomEditor(-1),
		},
		{
			label: 'Сбросить размер шрифта',
			icon: 'ri-restart-line',
			shortcut: 'Ctrl+0',
			action: () => zoomEditor(0, true),
		},
		{
			label: 'Дублировать строку',
			icon: 'ri-file-copy-line',
			shortcut: 'Shift+Alt+↓',
			action: duplicateLine,
		},
		{
			label: 'Переместить строку вверх',
			icon: 'ri-arrow-up-line',
			shortcut: 'Alt+↑',
			action: () => moveLine(-1),
		},
		{
			label: 'Переместить строку вниз',
			icon: 'ri-arrow-down-line',
			shortcut: 'Alt+↓',
			action: () => moveLine(1),
		},
		{
			label: 'Закрыть все вкладки',
			icon: 'ri-close-circle-line',
			action: closeAllTabs,
		},
	]
}

let paletteSelectedIndex = 0

function renderPalette(filter) {
	const list = document.getElementById('paletteList')
	list.innerHTML = ''
	const lower = filter.toLowerCase()
	const items = getCommands().filter(c => c.label.toLowerCase().includes(lower))
	if (paletteSelectedIndex >= items.length) paletteSelectedIndex = 0

	items.forEach((cmd, i) => {
		const row = document.createElement('div')
		row.className =
			'palette-item' + (i === paletteSelectedIndex ? ' selected' : '')
		row.innerHTML = `<i class="${cmd.icon || 'ri-terminal-box-line'}"></i><span class="palette-label">${escapeHtml(cmd.label)}</span>${cmd.shortcut ? `<span class="palette-shortcut">${cmd.shortcut}</span>` : ''}`
		row.addEventListener('click', () => runPaletteCommand(cmd))
		row.addEventListener('mouseenter', () => {
			paletteSelectedIndex = i
			renderPalette(filter)
		})
		list.appendChild(row)
	})
	list._items = items
}

function runPaletteCommand(cmd) {
	closeCommandPalette()
	cmd.action()
}

function openCommandPalette() {
	const modal = document.getElementById('commandPalette')
	if (!modal) return
	modal.classList.add('open')
	paletteSelectedIndex = 0
	const input = document.getElementById('paletteInput')
	input.value = ''
	renderPalette('')
	input.focus()
}

function closeCommandPalette() {
	const modal = document.getElementById('commandPalette')
	if (modal) modal.classList.remove('open')
	editorArea.focus()
}

function initCommandPalette() {
	const input = document.getElementById('paletteInput')
	if (!input) return
	input.addEventListener('input', () => {
		paletteSelectedIndex = 0
		renderPalette(input.value)
	})
	input.addEventListener('keydown', e => {
		const list = document.getElementById('paletteList')
		const items = list._items || []
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			paletteSelectedIndex = Math.min(
				items.length - 1,
				paletteSelectedIndex + 1,
			)
			renderPalette(input.value)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			paletteSelectedIndex = Math.max(0, paletteSelectedIndex - 1)
			renderPalette(input.value)
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (items[paletteSelectedIndex])
				runPaletteCommand(items[paletteSelectedIndex])
		} else if (e.key === 'Escape') {
			e.preventDefault()
			closeCommandPalette()
		}
	})
	document.getElementById('commandPalette').addEventListener('click', e => {
		if (e.target.id === 'commandPalette') closeCommandPalette()
	})
}
