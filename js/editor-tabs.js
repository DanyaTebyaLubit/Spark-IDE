// ============================================================
//  Вкладки и редактор
// ============================================================

function openFile(id) {
	if (!openTabs.includes(id)) openTabs.push(id)
	activeTabId = id
	renderTabs()
	renderTree()
	syncEditor()
	saveProjectToStorage()
}

function closeTab(id) {
	openTabs = openTabs.filter(t => t !== id)
	if (activeTabId === id) {
		activeTabId = openTabs.length ? openTabs[openTabs.length - 1] : null
	}
	renderTabs()
	renderTree()
	syncEditor()
	saveProjectToStorage()
}

function renderTabs() {
	tabbarEl.innerHTML = ''
	for (const id of openTabs) {
		const found = findNode(id)
		if (!found) continue
		const node = found.node
		const tab = document.createElement('div')
		tab.className = 'tab' + (id === activeTabId ? ' active' : '')
		const icon = document.createElement('i')
		icon.className = iconForFile(node.name) + ' tab-icon'
		const name = document.createElement('span')
		name.textContent = node.name
		const close = document.createElement('i')
		close.className = 'ri-close-line tab-close'
		close.addEventListener('click', e => {
			e.stopPropagation()
			closeTab(id)
		})
		tab.appendChild(icon)
		tab.appendChild(name)
		tab.appendChild(close)
		tab.addEventListener('click', () => {
			activeTabId = id
			renderTabs()
			renderTree()
			syncEditor()
			saveProjectToStorage()
		})
		tabbarEl.appendChild(tab)
	}
}

function syncEditor() {
	const found = activeTabId ? findNode(activeTabId) : null
	renderBreadcrumb()
	if (!found) {
		codeWrap.className = 'code-wrap no-file'
		editorArea.value = ''
		updateStatusBar()
		return
	}

	if (found.node.isBinary || isImageExt(found.node.name)) {
		codeWrap.className = 'code-wrap is-image'
		document.getElementById('imagePreviewTag').src = found.node.content
		document.getElementById('imagePreviewName').textContent = found.node.name
		updateStatusBar()
		return
	}

	codeWrap.className = 'code-wrap'
	editorArea.value = found.node.content
	updateGutter()
	updateHighlighting()
	updateStatusBar()
}

