// ============================================================
//  Разделитель Панелей (Resizer) и Горячие Клавиши
// ============================================================

function initResizer() {
	const resizer = document.getElementById('resizer')
	const previewCol = document.getElementById('previewCol')
	const mainGrid = document.getElementById('mainGrid')
	let isDragging = false

	if (!resizer || !previewCol || !mainGrid) return

	resizer.addEventListener('mousedown', () => {
		isDragging = true
		resizer.classList.add('dragging')
		document.body.style.cursor = 'col-resize'
		document.body.style.userSelect = 'none'
	})

	window.addEventListener('mousemove', e => {
		if (!isDragging) return
		const containerWidth = mainGrid.clientWidth
		const newPreviewWidth =
			((containerWidth - e.clientX) / containerWidth) * 100
		if (newPreviewWidth > 15 && newPreviewWidth < 80) {
			previewCol.style.width = `${newPreviewWidth}%`
		}
	})

	window.addEventListener('mouseup', () => {
		if (isDragging) {
			isDragging = false
			resizer.classList.remove('dragging')
			document.body.style.cursor = ''
			document.body.style.userSelect = ''
		}
	})
}

function initShortcuts() {
	window.addEventListener('keydown', e => {
		const ctrl = e.ctrlKey || e.metaKey

		if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') {
			e.preventDefault()
			openCommandPalette()
			return
		}
		if (ctrl && e.shiftKey && e.key.toLowerCase() === 'f') {
			e.preventDefault()
			openGlobalSearch()
			return
		}
		if (ctrl && e.shiftKey && e.key.toLowerCase() === 'a') {
			e.preventDefault()
			openAiAssistant()
			return
		}
		if (e.key === 'Escape') {
			closeCommandPalette()
			closeGlobalSearch()
			closeFindPanel()
			closeAiAssistant()
		}
		if (ctrl && e.key.toLowerCase() === 'b') {
			e.preventDefault()
			document.getElementById('sidebar').classList.toggle('collapsed')
		}
		if (ctrl && e.key === '/') {
			e.preventDefault()
			document.getElementById('mainGrid').classList.toggle('no-preview')
		}
		if (ctrl && e.key.toLowerCase() === 's') {
			e.preventDefault()
			run()
		}
		if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
			e.preventDefault()
			formatCurrentFile()
		}
		if (ctrl && (e.key === '=' || e.key === '+')) {
			e.preventDefault()
			zoomEditor(1)
		}
		if (ctrl && e.key === '-') {
			e.preventDefault()
			zoomEditor(-1)
		}
		if (ctrl && e.key === '0') {
			e.preventDefault()
			zoomEditor(0, true)
		}
	})
}
