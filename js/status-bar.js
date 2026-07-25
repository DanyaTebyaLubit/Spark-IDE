// ============================================================
//  Хлебные крошки, статус-бар и масштаб редактора
// ============================================================

function pathPartsFor(id) {
	const parts = []
	let curr = findNode(id)
	while (curr && curr.parent) {
		parts.unshift(curr.node)
		curr = findNode(curr.parent.id)
	}
	return parts
}

function renderBreadcrumb() {
	const el = document.getElementById('breadcrumb')
	if (!el) return
	el.innerHTML = ''
	const found = activeTabId ? findNode(activeTabId) : null
	if (!found) {
		el.style.display = 'none'
		return
	}
	el.style.display = 'flex'
	const parts = pathPartsFor(activeTabId)
	parts.forEach((node, i) => {
		if (i > 0) {
			const sep = document.createElement('i')
			sep.className = 'ri-arrow-right-s-line crumb-sep'
			el.appendChild(sep)
		}
		const crumb = document.createElement('span')
		crumb.className = 'crumb' + (i === parts.length - 1 ? ' crumb-current' : '')
		const icon = document.createElement('i')
		icon.className = node.type === 'folder' ? 'ri-folder-3-line' : iconForFile(node.name)
		crumb.appendChild(icon)
		const label = document.createElement('span')
		label.textContent = node.name
		crumb.appendChild(label)
		if (node.type === 'folder') {
			crumb.addEventListener('click', () => {
				selectedFolderId = node.id
				node.open = true
				renderTree()
				saveProjectToStorage()
			})
		}
		el.appendChild(crumb)
	})
}

let editorFontSize = parseFloat(localStorage.getItem('spark-fontsize')) || 13.5

function applyEditorFontSize() {
	document.documentElement.style.setProperty('--editor-font-size', editorFontSize + 'px')
	updateStatusBar()
}

function zoomEditor(delta, reset) {
	editorFontSize = reset ? 13.5 : Math.min(24, Math.max(10, editorFontSize + delta))
	localStorage.setItem('spark-fontsize', editorFontSize)
	applyEditorFontSize()
}

function updateStatusBar() {
	const bar = document.getElementById('statusBar')
	if (!bar) return
	const found = activeTabId ? findNode(activeTabId) : null
	const posEl = document.getElementById('statusPos')
	const fileEl = document.getElementById('statusFile')
	const zoomEl = document.getElementById('statusZoom')
	const entryEl = document.getElementById('statusEntry')

	if (!found) {
		posEl.textContent = ''
		fileEl.textContent = 'Нет открытого файла'
		entryEl.textContent = ''
	} else {
		fileEl.textContent = found.node.name
		if (found.node.isBinary || isImageExt(found.node.name)) {
			posEl.textContent = 'Изображение'
		} else {
			const value = editorArea.value
			const pos = editorArea.selectionStart
			const before = value.slice(0, pos)
			const line = before.split('\n').length
			const col = pos - before.lastIndexOf('\n')
			const totalLines = value.split('\n').length
			posEl.textContent = `Строка ${line}, Столбец ${col} · Всего строк: ${totalLines}`
		}
		entryEl.textContent = found.node.id === entryFileId ? '⚡ Точка входа' : ''
	}
	zoomEl.textContent = Math.round((editorFontSize / 13.5) * 100) + '%'
}

function updateGutter() {
	const lineCount = editorArea.value.split('\n').length
	let out = ''
	for (let i = 1; i <= lineCount; i++) out += i + '\n'
	gutterEl.textContent = out
	gutterEl.scrollTop = editorArea.scrollTop
}

function commitEditorChange() {
	const found = activeTabId ? findNode(activeTabId) : null
	if (found) {
		found.node.content = editorArea.value
		if (found.node.name === 'settings.json') processDynamicTheme()
		saveProjectToStorage()
	}
	updateGutter()
	updateHighlighting()
	updateStatusBar()
}

editorArea.addEventListener('input', commitEditorChange)

editorArea.addEventListener('scroll', () => {
	gutterEl.scrollTop = editorArea.scrollTop
	highlightArea.scrollTop = editorArea.scrollTop
	highlightArea.scrollLeft = editorArea.scrollLeft
})
;['keyup', 'click', 'focus'].forEach(evt =>
	editorArea.addEventListener(evt, updateStatusBar),
)

function scrollSelectionIntoView() {
	const pos = editorArea.selectionStart
	const line = editorArea.value.slice(0, pos).split('\n').length
	const lineHeight = 21.6
	const target = (line - 1) * lineHeight
	if (target < editorArea.scrollTop || target > editorArea.scrollTop + editorArea.clientHeight - lineHeight) {
		editorArea.scrollTop = Math.max(0, target - editorArea.clientHeight / 2)
	}
}

const BRACKET_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" }
const CLOSING_CHARS = new Set([')', ']', '}', '"', "'"])

function duplicateLine() {
	const start = editorArea.selectionStart
	const value = editorArea.value
	const lineStart = value.lastIndexOf('\n', start - 1) + 1
	let lineEnd = value.indexOf('\n', start)
	if (lineEnd === -1) lineEnd = value.length
	const line = value.slice(lineStart, lineEnd)
	editorArea.value = value.slice(0, lineEnd) + '\n' + line + value.slice(lineEnd)
	editorArea.selectionStart = editorArea.selectionEnd = lineEnd + 1 + (start - lineStart)
	commitEditorChange()
}

function moveLine(dir) {
	const value = editorArea.value
	const start = editorArea.selectionStart
	const lines = value.split('\n')
	const offsets = []
	let acc = 0
	for (const l of lines) {
		offsets.push(acc)
		acc += l.length + 1
	}
	let idx = offsets.length - 1
	for (let i = 0; i < offsets.length; i++) {
		if (start >= offsets[i] && start < offsets[i] + lines[i].length + 1) {
			idx = i
			break
		}
	}
	const target = idx + dir
	if (target < 0 || target >= lines.length) return
	const col = start - offsets[idx]
	const tmp = lines[idx]
	lines[idx] = lines[target]
	lines[target] = tmp
	editorArea.value = lines.join('\n')
	let newOffset = 0
	for (let i = 0; i < target; i++) newOffset += lines[i].length + 1
	editorArea.selectionStart = editorArea.selectionEnd = newOffset + Math.min(col, lines[target].length)
	commitEditorChange()
	scrollSelectionIntoView()
}

function toggleComment() {
	const start = editorArea.selectionStart,
		end = editorArea.selectionEnd
	const value = editorArea.value
	const lineStart = value.lastIndexOf('\n', start - 1) + 1
	let lineEnd = value.indexOf('\n', end - 1)
	if (lineEnd === -1) lineEnd = value.length
	const block = value.slice(lineStart, lineEnd)
	const lines = block.split('\n')
	const allCommented = lines.every(l => l.trim() === '' || l.trim().startsWith('//'))
	let newLines
	if (allCommented) {
		newLines = lines.map(l => l.replace(/^(\s*)\/\/ ?/, '$1'))
	} else {
		newLines = lines.map(l => (l.trim() === '' ? l : l.replace(/^(\s*)/, '$1// ')))
	}
	const newBlock = newLines.join('\n')
	editorArea.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
	editorArea.selectionStart = lineStart
	editorArea.selectionEnd = lineStart + newBlock.length
	commitEditorChange()
}

function selectNextOccurrence() {
	const value = editorArea.value
	let start = editorArea.selectionStart,
		end = editorArea.selectionEnd
	let word = value.slice(start, end)
	if (!word) {
		const left = (value.slice(0, start).match(/[\w-]*$/) || [''])[0]
		const right = (value.slice(end).match(/^[\w-]*/) || [''])[0]
		start -= left.length
		end += right.length
		word = value.slice(start, end)
		if (!word) return
		editorArea.selectionStart = start
		editorArea.selectionEnd = end
		return
	}
	let idx = value.indexOf(word, end)
	if (idx === -1) idx = value.indexOf(word)
	if (idx === -1) return
	editorArea.selectionStart = idx
	editorArea.selectionEnd = idx + word.length
	scrollSelectionIntoView()
}

editorArea.addEventListener('keydown', e => {
	const ctrl = e.ctrlKey || e.metaKey

	if (ctrl && e.key === '/') {
		e.preventDefault()
		e.stopPropagation()
		toggleComment()
		return
	}
	if (ctrl && e.key.toLowerCase() === 'd') {
		e.preventDefault()
		e.stopPropagation()
		selectNextOccurrence()
		return
	}
	if (ctrl && e.key.toLowerCase() === 'f') {
		e.preventDefault()
		e.stopPropagation()
		openFindPanel(false)
		return
	}
	if (ctrl && e.key.toLowerCase() === 'h') {
		e.preventDefault()
		e.stopPropagation()
		openFindPanel(true)
		return
	}
	if (e.altKey && !e.shiftKey && e.key === 'ArrowUp') {
		e.preventDefault()
		moveLine(-1)
		return
	}
	if (e.altKey && !e.shiftKey && e.key === 'ArrowDown') {
		e.preventDefault()
		moveLine(1)
		return
	}
	if (e.altKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
		e.preventDefault()
		duplicateLine()
		return
	}

	if (e.key === 'Enter') {
		e.preventDefault()
		const start = editorArea.selectionStart,
			end = editorArea.selectionEnd
		const value = editorArea.value
		const lineStart = value.lastIndexOf('\n', start - 1) + 1
		const currentLine = value.slice(lineStart, start)
		const indentMatch = currentLine.match(/^[ \t]*/)
		let indent = indentMatch ? indentMatch[0] : ''
		if (/[:{(\[]\s*$/.test(currentLine)) indent += '  '
		const insert = '\n' + indent
		editorArea.value = value.slice(0, start) + insert + value.slice(end)
		editorArea.selectionStart = editorArea.selectionEnd = start + insert.length
		commitEditorChange()
		return
	}

	if (e.key === 'Tab') {
		e.preventDefault()
		const start = editorArea.selectionStart,
			end = editorArea.selectionEnd
		const value = editorArea.value
		const multiLine = start !== end && value.slice(start, end).includes('\n')

		if (!multiLine) {
			if (e.shiftKey) {
				const lineStart = value.lastIndexOf('\n', start - 1) + 1
				const line = value.slice(lineStart, value.indexOf('\n', lineStart) === -1 ? value.length : value.indexOf('\n', lineStart))
				let cut = 0
				if (line.startsWith('  ')) cut = 2
				else if (line.startsWith(' ') || line.startsWith('\t')) cut = 1
				if (cut) {
					editorArea.value = value.slice(0, lineStart) + line.slice(cut) + value.slice(lineStart + line.length)
					editorArea.selectionStart = editorArea.selectionEnd = Math.max(lineStart, start - cut)
				}
			} else {
				editorArea.value = value.slice(0, start) + '  ' + value.slice(end)
				editorArea.selectionStart = editorArea.selectionEnd = start + 2
			}
		} else {
			const lineStart = value.lastIndexOf('\n', start - 1) + 1
			let lineEnd = value.indexOf('\n', end - 1)
			if (lineEnd === -1) lineEnd = value.length
			const block = value.slice(lineStart, lineEnd)
			const lines = block.split('\n')
			let newLines
			if (e.shiftKey) {
				newLines = lines.map(l => (l.startsWith('  ') ? l.slice(2) : l.startsWith('\t') || l.startsWith(' ') ? l.slice(1) : l))
			} else {
				newLines = lines.map(l => '  ' + l)
			}
			const newBlock = newLines.join('\n')
			editorArea.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
			editorArea.selectionStart = lineStart
			editorArea.selectionEnd = lineStart + newBlock.length
		}
		commitEditorChange()
		return
	}

	if (
		editorArea.selectionStart === editorArea.selectionEnd &&
		CLOSING_CHARS.has(e.key) &&
		editorArea.value[editorArea.selectionStart] === e.key
	) {
		e.preventDefault()
		editorArea.selectionStart = editorArea.selectionEnd = editorArea.selectionStart + 1
		return
	}

	if (BRACKET_PAIRS[e.key]) {
		e.preventDefault()
		const start = editorArea.selectionStart,
			end = editorArea.selectionEnd
		const value = editorArea.value
		if (start !== end) {
			const selText = value.slice(start, end)
			const insert = e.key + selText + BRACKET_PAIRS[e.key]
			editorArea.value = value.slice(0, start) + insert + value.slice(end)
			editorArea.selectionStart = start + 1
			editorArea.selectionEnd = start + 1 + selText.length
		} else {
			const insert = e.key + BRACKET_PAIRS[e.key]
			editorArea.value = value.slice(0, start) + insert + value.slice(start)
			editorArea.selectionStart = editorArea.selectionEnd = start + 1
		}
		commitEditorChange()
		return
	}
})

