// ============================================================
//  Глобальный поиск по проекту (Ctrl+Shift+F)
// ============================================================

function jumpToLine(lineNo) {
	const value = editorArea.value
	const lines = value.split('\n')
	let pos = 0
	for (let i = 0; i < lineNo - 1 && i < lines.length; i++) pos += lines[i].length + 1
	const lineLen = lines[lineNo - 1] ? lines[lineNo - 1].length : 0
	editorArea.focus()
	editorArea.setSelectionRange(pos, pos + lineLen)
	updateGutter()
	scrollSelectionIntoView()
	updateStatusBar()
}

function openGlobalSearch() {
	const modal = document.getElementById('globalSearchModal')
	if (!modal) return
	modal.classList.add('open')
	const input = document.getElementById('globalSearchInput')
	input.value = ''
	document.getElementById('globalSearchResults').innerHTML = ''
	input.focus()
}

function closeGlobalSearch() {
	const modal = document.getElementById('globalSearchModal')
	if (modal) modal.classList.remove('open')
}

function doGlobalSearch(term) {
	const container = document.getElementById('globalSearchResults')
	container.innerHTML = ''
	if (!term) return
	const files = []
	walkFiles(project, '', files)
	const lower = term.toLowerCase()
	let totalMatches = 0

	for (const [path, content] of files) {
		if (typeof content !== 'string' || content.startsWith('data:')) continue
		const lines = content.split('\n')
		const fileMatches = []
		lines.forEach((line, i) => {
			if (line.toLowerCase().includes(lower)) fileMatches.push({ lineNo: i + 1, lineText: line })
		})
		if (!fileMatches.length) continue
		totalMatches += fileMatches.length

		const group = document.createElement('div')
		group.className = 'gs-group'
		const head = document.createElement('div')
		head.className = 'gs-file'
		head.innerHTML = `<i class="ri-file-3-line"></i><span>${escapeHtml(path)}</span><span class="gs-count">${fileMatches.length}</span>`
		group.appendChild(head)

		fileMatches.slice(0, 50).forEach(m => {
			const row = document.createElement('div')
			row.className = 'gs-line'
			const idx = m.lineText.toLowerCase().indexOf(lower)
			const before = escapeHtml(m.lineText.slice(0, idx))
			const mid = escapeHtml(m.lineText.slice(idx, idx + term.length))
			const after = escapeHtml(m.lineText.slice(idx + term.length))
			row.innerHTML = `<span class="gs-lineno">${m.lineNo}</span><span class="gs-text">${before}<mark>${mid}</mark>${after}</span>`
			row.addEventListener('click', () => {
				const node = resolveFilePath(path)
				if (node) {
					openFile(node.id)
					setTimeout(() => jumpToLine(m.lineNo), 0)
				}
				closeGlobalSearch()
			})
			group.appendChild(row)
		})
		container.appendChild(group)
	}

	if (!totalMatches) {
		container.innerHTML = '<div class="gs-empty">Совпадений не найдено</div>'
	}
}

function initGlobalSearch() {
	const input = document.getElementById('globalSearchInput')
	if (!input) return
	let debounceTimer = null
	input.addEventListener('input', () => {
		clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => doGlobalSearch(input.value.trim()), 120)
	})
	input.addEventListener('keydown', e => {
		if (e.key === 'Escape') closeGlobalSearch()
	})
	document.getElementById('globalSearchCloseBtn').addEventListener('click', closeGlobalSearch)
	document.getElementById('globalSearchModal').addEventListener('click', e => {
		if (e.target.id === 'globalSearchModal') closeGlobalSearch()
	})
}

