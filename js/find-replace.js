// ============================================================
//  Поиск и замена в файле (Ctrl+F / Ctrl+H)
// ============================================================

const findState = { matches: [], currentIndex: -1, term: '' }

function openFindPanel(withReplace) {
	const panel = document.getElementById('findPanel')
	if (!panel) return
	const found = activeTabId ? findNode(activeTabId) : null
	if (!found || found.node.isBinary || isImageExt(found.node.name)) return
	panel.classList.add('open')
	panel.classList.toggle('with-replace', !!withReplace)
	const input = document.getElementById('findInput')
	const sel = editorArea.value.slice(editorArea.selectionStart, editorArea.selectionEnd)
	if (sel) input.value = sel
	input.focus()
	input.select()
	doFind()
}

function closeFindPanel() {
	const panel = document.getElementById('findPanel')
	if (panel) panel.classList.remove('open')
	editorArea.focus()
}

function updateFindCount() {
	const el = document.getElementById('findCount')
	if (!el) return
	if (!findState.term) {
		el.textContent = ''
	} else {
		el.textContent = findState.matches.length
			? `${findState.currentIndex + 1} из ${findState.matches.length}`
			: 'Нет совпадений'
	}
}

function selectMatch(i) {
	if (!findState.matches.length) return
	const pos = findState.matches[i]
	editorArea.focus()
	editorArea.setSelectionRange(pos, pos + findState.term.length)
	scrollSelectionIntoView()
	updateStatusBar()
}

function doFind() {
	const term = document.getElementById('findInput').value
	findState.term = term
	findState.matches = []
	findState.currentIndex = -1
	if (!term) {
		updateFindCount()
		return
	}
	const caseBtn = document.getElementById('findCaseBtn')
	const caseSensitive = caseBtn && caseBtn.classList.contains('active')
	const text = editorArea.value
	const hay = caseSensitive ? text : text.toLowerCase()
	const needle = caseSensitive ? term : term.toLowerCase()
	let idx = 0
	while (true) {
		const found = hay.indexOf(needle, idx)
		if (found === -1) break
		findState.matches.push(found)
		idx = found + Math.max(needle.length, 1)
	}
	if (findState.matches.length) {
		const cursor = editorArea.selectionStart
		let ci = findState.matches.findIndex(m => m >= cursor)
		if (ci === -1) ci = 0
		findState.currentIndex = ci
		selectMatch(ci)
	}
	updateFindCount()
}

function findNext() {
	if (!findState.matches.length) return
	findState.currentIndex = (findState.currentIndex + 1) % findState.matches.length
	selectMatch(findState.currentIndex)
	updateFindCount()
}

function findPrev() {
	if (!findState.matches.length) return
	findState.currentIndex =
		(findState.currentIndex - 1 + findState.matches.length) % findState.matches.length
	selectMatch(findState.currentIndex)
	updateFindCount()
}

function replaceOne() {
	if (findState.currentIndex === -1 || !findState.matches.length) return
	const replaceVal = document.getElementById('replaceInput').value
	const pos = findState.matches[findState.currentIndex]
	const value = editorArea.value
	editorArea.value = value.slice(0, pos) + replaceVal + value.slice(pos + findState.term.length)
	editorArea.selectionStart = editorArea.selectionEnd = pos + replaceVal.length
	commitEditorChange()
	doFind()
}

function replaceAll() {
	if (!findState.matches.length) return
	const replaceVal = document.getElementById('replaceInput').value
	const term = findState.term
	const caseBtn = document.getElementById('findCaseBtn')
	const caseSensitive = caseBtn && caseBtn.classList.contains('active')
	const value = editorArea.value
	let result = '',
		lastIdx = 0
	const hay = caseSensitive ? value : value.toLowerCase()
	const needle = caseSensitive ? term : term.toLowerCase()
	let idx
	while ((idx = hay.indexOf(needle, lastIdx)) !== -1) {
		result += value.slice(lastIdx, idx) + replaceVal
		lastIdx = idx + term.length
	}
	result += value.slice(lastIdx)
	editorArea.value = result
	commitEditorChange()
	doFind()
}

function initFindPanel() {
	const input = document.getElementById('findInput')
	if (!input) return
	input.addEventListener('input', doFind)
	input.addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			e.preventDefault()
			e.shiftKey ? findPrev() : findNext()
		}
		if (e.key === 'Escape') {
			e.preventDefault()
			closeFindPanel()
		}
	})
	document.getElementById('findNextBtn').addEventListener('click', findNext)
	document.getElementById('findPrevBtn').addEventListener('click', findPrev)
	document.getElementById('findCloseBtn').addEventListener('click', closeFindPanel)
	document.getElementById('findCaseBtn').addEventListener('click', e => {
		e.currentTarget.classList.toggle('active')
		doFind()
	})
	document.getElementById('replaceOneBtn').addEventListener('click', replaceOne)
	document.getElementById('replaceAllBtn').addEventListener('click', replaceAll)
}

