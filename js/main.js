// ============================================================
//  Запуск / компиляция / UI listeners
// ============================================================

function showError(message) {
	errbar.innerHTML = ''
	const icon = document.createElement('i')
	icon.className = 'ri-error-warning-line'
	const msg = document.createElement('span')
	msg.textContent = message
	msg.className = 'errbar-text'
	const aiBtn = document.createElement('button')
	aiBtn.className = 'errbar-ai-btn'
	aiBtn.innerHTML = '<i class="ri-sparkling-2-line"></i>Спросить ИИ'
	aiBtn.title = 'Объяснить ошибку с помощью ИИ-помощника'
	aiBtn.addEventListener('click', () => aiExplainError(message))
	errbar.appendChild(icon)
	errbar.appendChild(msg)
	errbar.appendChild(aiBtn)
	errbar.style.display = 'flex'
}
function clearError() {
	errbar.style.display = 'none'
}

function run() {
	saveProjectToStorage()
	clearConsole()
	const { entryFile, cssCombined, jsCombined } = getEntryAndCss()
	if (!entryFile) {
		showError('В проекте нет ни одного .spark файла для запуска.')
		return
	}
	try {
		const result = compileSpark(entryFile.content, cssCombined, jsCombined)
		preview.srcdoc = result.previewHtml
		clearError()
		renderTree()
		const runBtn = document.getElementById('runBtn')
		if (runBtn) {
			runBtn.classList.remove('charging')
			void runBtn.offsetWidth
			runBtn.classList.add('charging')
		}
	} catch (e) {
		showError(e.message)
	}
}

// Привязка обработчиков интерфейса шапки и палитр
document.addEventListener('DOMContentLoaded', () => {
	if (!loadProjectFromStorage()) {
		saveProjectToStorage()
	}

	const savedTheme = localStorage.getItem('spark-theme')
	if (savedTheme === 'light') document.body.classList.add('light-theme')

	processDynamicTheme()
	initConsoleUI()
	applyEditorFontSize()
	initFindPanel()
	initGlobalSearch()
	initCommandPalette()
	initAutocomplete()
	initAiAssistant()

	document
		.getElementById('globalSearchBtn')
		.addEventListener('click', openGlobalSearch)
	document
		.getElementById('commandPaletteBtn')
		.addEventListener('click', openCommandPalette)
	document
		.getElementById('zoomInBtn')
		.addEventListener('click', () => zoomEditor(1))
	document
		.getElementById('zoomOutBtn')
		.addEventListener('click', () => zoomEditor(-1))

	// Переключатели панелей и темы
	document.getElementById('sidebarToggle').addEventListener('click', () => {
		document.getElementById('sidebar').classList.toggle('collapsed')
	})

	document.getElementById('previewToggle').addEventListener('click', () => {
		document.getElementById('mainGrid').classList.toggle('no-preview')
	})

	document.getElementById('themeToggle').addEventListener('click', () => {
		document.body.classList.toggle('light-theme')
		saveProjectToStorage()
	})

	// Кнопки управления файлами и проектом
	document
		.getElementById('newFileBtn')
		.addEventListener('click', () => createFile())
	document
		.getElementById('newFolderBtn')
		.addEventListener('click', () => createFolder())

	document.getElementById('newProjectBtn').addEventListener('click', () => {
		if (
			confirm(
				'Сбросить текущий проект до стандартного шаблона? Несохраненные изменения будут потеряны.',
			)
		) {
			localStorage.removeItem('spark-project')
			localStorage.removeItem('spark-openTabs')
			localStorage.removeItem('spark-activeTab')
			localStorage.removeItem('spark-entryFileId')
			location.reload()
		}
	})

	document.getElementById('openProjectBtn').addEventListener('click', () => {
		document.getElementById('importProjectInput').click()
	})

	document
		.getElementById('importProjectInput')
		.addEventListener('change', e => {
			if (e.target.files.length) {
				importProjectZip(e.target.files[0])
			}
		})

	document
		.getElementById('formatBtn')
		.addEventListener('click', formatCurrentFile)
	document.getElementById('runBtn').addEventListener('click', run)

	// Выпадающее меню экспорта
	const dlMenu = document.getElementById('dlMenu')
	document.getElementById('downloadCaret').addEventListener('click', e => {
		e.stopPropagation()
		dlMenu.classList.toggle('open')
	})

	document
		.getElementById('downloadBtn')
		.addEventListener('click', exportCompiledSite)
	document.getElementById('exportSiteItem').addEventListener('click', () => {
		dlMenu.classList.remove('open')
		exportCompiledSite()
	})
	document.getElementById('exportProjectItem').addEventListener('click', () => {
		dlMenu.classList.remove('open')
		exportProjectZip()
	})

	document.addEventListener('click', () => dlMenu.classList.remove('open'))

	initResizer()
	initShortcuts()

	renderTree()
	renderTabs()
	syncEditor()
	run()
})
