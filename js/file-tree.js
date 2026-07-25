// ============================================================
//  Рендер дерева файлов
// ============================================================

const treeEl = document.getElementById('tree')
const tabbarEl = document.getElementById('tabbar')
const editorArea = document.getElementById('editorArea')
const highlightArea = document.getElementById('highlightArea')
const gutterEl = document.getElementById('gutter')
const codeWrap = document.querySelector('.code-wrap')
const preview = document.getElementById('preview')
const errbar = document.getElementById('errbar')

function renderTree() {
	treeEl.innerHTML = ''
	renderFolderChildren(project, treeEl, 0)
}

function renderFolderChildren(folder, container, depth) {
	for (const node of folder.children) {
		container.appendChild(renderRow(node, depth))
		if (node.type === 'folder' && node.open) {
			renderFolderChildren(node, container, depth + 1)
		}
	}
}

function renderRow(node, depth) {
	const row = document.createElement('div')
	row.className = 'row'
	row.style.paddingLeft = 10 + depth * 15 + 'px'
	row.dataset.id = node.id

	if (node.id === activeTabId && node.type === 'file')
		row.classList.add('active-file')
	if (node.id === selectedFolderId && node.type === 'folder')
		row.classList.add('selected-folder')

	const main = document.createElement('div')
	main.className = 'row-main'

	if (node.type === 'folder') {
		const chev = document.createElement('i')
		chev.className =
			'ri-arrow-right-s-line chevron' + (node.open ? ' open' : '')
		main.appendChild(chev)
		const icon = document.createElement('i')
		icon.className =
			(node.open ? 'ri-folder-open-fill' : 'ri-folder-fill') +
			' node-icon folder-icon'
		main.appendChild(icon)
	} else {
		const spacer = document.createElement('span')
		spacer.className = 'chevron'
		main.appendChild(spacer)
		const icon = document.createElement('i')
		icon.className = iconForFile(node.name) + ' node-icon'
		main.appendChild(icon)
	}

	if (node.editing) {
		const input = document.createElement('input')
		input.className = 'rename-input'
		input.value = node.name
		input.addEventListener('click', e => e.stopPropagation())
		input.addEventListener('keydown', e => {
			e.stopPropagation()
			if (e.key === 'Enter') input.blur()
			if (e.key === 'Escape') {
				if (node._isNew) removeNode(node.id)
				else {
					node.editing = false
					renderTree()
				}
			}
		})
		input.addEventListener('blur', () => commitRename(node, input.value))
		main.appendChild(input)
		setTimeout(() => {
			input.focus()
			input.select()
		}, 0)
	} else {
		const name = document.createElement('span')
		name.className = 'node-name'
		name.textContent = node.name
		main.appendChild(name)
		if (node.type === 'file' && node.id === entryFileId) {
			const badge = document.createElement('i')
			badge.className = 'ri-flashlight-fill entry-badge'
			badge.title = 'Точка входа'
			main.appendChild(badge)
		}
	}

	row.appendChild(main)

	const actions = document.createElement('div')
	actions.className = 'row-actions'
	const renameBtn = document.createElement('button')
	renameBtn.innerHTML = '<i class="ri-edit-line"></i>'
	renameBtn.title = 'Переименовать'
	renameBtn.addEventListener('click', e => {
		e.stopPropagation()
		startRename(node)
	})
	actions.appendChild(renameBtn)
	const delBtn = document.createElement('button')
	delBtn.innerHTML = '<i class="ri-delete-bin-line"></i>'
	delBtn.title = 'Удалить'
	delBtn.addEventListener('click', e => {
		e.stopPropagation()
		requestDelete(node)
	})
	actions.appendChild(delBtn)
	row.appendChild(actions)

	row.addEventListener('click', () => {
		if (node.type === 'folder') {
			node.open = !node.open
			selectedFolderId = node.id
			renderTree()
			saveProjectToStorage()
		} else {
			selectedFolderId = findNode(node.id).parent.id
			openFile(node.id)
		}
	})

	row.addEventListener('contextmenu', e => {
		e.preventDefault()
		e.stopPropagation()
		openContextMenu(e.clientX, e.clientY, node)
	})

	row.draggable = true
	row.addEventListener('dragstart', e => {
		e.stopPropagation()
		e.dataTransfer.setData('text/plain', node.id)
		e.dataTransfer.effectAllowed = 'move'
	})
	row.addEventListener('dragover', e => {
		e.preventDefault()
		e.stopPropagation()
		row.classList.add('drag-over')
	})
	row.addEventListener('dragleave', () => row.classList.remove('drag-over'))
	row.addEventListener('drop', e => {
		e.preventDefault()
		e.stopPropagation()
		row.classList.remove('drag-over')
		const draggedId = e.dataTransfer.getData('text/plain')
		if (!draggedId || draggedId === node.id) return
		if (node.type === 'folder') {
			moveNodeTo(draggedId, node)
		} else {
			const info = findNode(node.id)
			if (info && info.parent) {
				const idx = info.parent.children.findIndex(c => c.id === node.id)
				moveNodeTo(draggedId, info.parent, idx + 1)
			}
		}
	})

	return row
}

function isDescendantOrSelf(node, targetId) {
	if (node.id === targetId) return true
	if (node.type === 'folder')
		return node.children.some(c => isDescendantOrSelf(c, targetId))
	return false
}

function moveNodeTo(draggedId, targetFolder, index) {
	const found = findNode(draggedId)
	if (!found || !found.parent) return
	if (isDescendantOrSelf(found.node, targetFolder.id)) return
	found.parent.children = found.parent.children.filter(c => c.id !== draggedId)
	if (index === undefined || index > targetFolder.children.length) {
		targetFolder.children.push(found.node)
	} else {
		targetFolder.children.splice(index, 0, found.node)
	}
	targetFolder.open = true
	renderTree()
	saveProjectToStorage()
}

treeEl.addEventListener('contextmenu', e => {
	if (e.target !== treeEl) return
	e.preventDefault()
	selectedFolderId = project.id
	openContextMenu(e.clientX, e.clientY, null)
})

treeEl.addEventListener('dragover', e => {
	if (e.target !== treeEl) return
	e.preventDefault()
})
treeEl.addEventListener('drop', e => {
	if (e.target !== treeEl) return
	e.preventDefault()
	const draggedId = e.dataTransfer.getData('text/plain')
	if (draggedId) moveNodeTo(draggedId, project)
})

// ---------- Создание / Переименование / Удаление / Ресурсы ----------

function targetFolder() {
	const found = selectedFolderId ? findNode(selectedFolderId) : null
	return found && found.node.type === 'folder' ? found.node : project
}

function createFile(parent) {
	const folder = parent || targetFolder()
	const file = makeFile('', '')
	file.editing = true
	file._isNew = true
	folder.open = true
	folder.children.push(file)
	renderTree()
}

function createFolder(parent) {
	const folder = parent || targetFolder()
	const newFolder = makeFolder('', [])
	newFolder.editing = true
	newFolder._isNew = true
	folder.open = true
	folder.children.push(newFolder)
	renderTree()
}

// Загрузка ресурсов
document.getElementById('uploadResourceBtn').addEventListener('click', () => {
	document.getElementById('uploadResourceInput').click()
})
document
	.getElementById('uploadResourceInput')
	.addEventListener('change', async e => {
		const files = e.target.files
		const parent = targetFolder()
		for (let file of files) {
			const reader = new FileReader()
			reader.onload = ev => {
				const content = ev.target.result
				const newFile = makeFile(file.name, content, true)
				parent.children.push(newFile)
				renderTree()
				saveProjectToStorage()
			}
			reader.readAsDataURL(file)
		}
	})

function defaultContentFor(name) {
	if (name.endsWith('.spark'))
		return `page NewPage\n\n.card {\n  bg: #1e1e2e\n  p: 20px\n  radius: 12px\n\n  h1 {\n    text: Новая страница\n  }\n}\n`
	if (name.endsWith('.spstyle')) return `/* новые стили */\n`
	if (name.endsWith('.spjs'))
		return `// Обычный JavaScript — выполняется как есть внутри страницы\n// (доступны select, value, text, html, css, hide, show, toggle, print — как в обработчиках Spark)\n`
	if (name.endsWith('settings.json')) return DEFAULT_SETTINGS
	return ''
}

function commitRename(node, rawValue) {
	const value = rawValue.trim()
	if (!value) {
		if (node._isNew) {
			removeNode(node.id)
			return
		}
		node.editing = false
		renderTree()
		return
	}
	const wasNew = node._isNew
	node.name = value
	node.editing = false
	delete node._isNew
	if (wasNew && node.type === 'file') node.content = defaultContentFor(value)

	if (value === 'settings.json') processDynamicTheme()

	renderTree()
	if (wasNew && node.type === 'file') openFile(node.id)
	saveProjectToStorage()
}

function startRename(node) {
	node.editing = true
	renderTree()
}

function requestDelete(node) {
	const label =
		node.type === 'folder'
			? `папку «${node.name}» со всем содержимым`
			: `файл «${node.name}»`
	if (!confirm(`Удалить ${label}?`)) return
	removeNode(node.id)
	processDynamicTheme()
}

function collectFileIds(node, acc) {
	if (node.type === 'file') acc.push(node.id)
	else node.children.forEach(c => collectFileIds(c, acc))
	return acc
}

function removeNode(id) {
	const found = findNode(id)
	if (!found || !found.parent) return
	const removedIds = collectFileIds(found.node, [])
	found.parent.children = found.parent.children.filter(c => c.id !== id)
	openTabs = openTabs.filter(t => !removedIds.includes(t))
	if (removedIds.includes(activeTabId)) {
		activeTabId = openTabs.length ? openTabs[openTabs.length - 1] : null
	}
	if (removedIds.includes(entryFileId)) entryFileId = null
	if (selectedFolderId === id) selectedFolderId = project.id
	renderTree()
	renderTabs()
	syncEditor()
	saveProjectToStorage()
}

function setEntry(node) {
	entryFileId = node.id
	renderTree()
	saveProjectToStorage()
}

// ---------- Контекстное меню ----------

let ctxMenuEl = null
function closeContextMenu() {
	if (ctxMenuEl) {
		ctxMenuEl.remove()
		ctxMenuEl = null
	}
}
document.addEventListener('click', closeContextMenu)
document.addEventListener('scroll', closeContextMenu, true)
window.addEventListener('blur', closeContextMenu)

function ctxItem(icon, label, onClick, danger) {
	const item = document.createElement('div')
	item.className = 'ctx-item' + (danger ? ' danger' : '')
	item.innerHTML = `<i class="${icon}"></i>${label}`
	item.addEventListener('click', () => {
		closeContextMenu()
		onClick()
	})
	return item
}
function ctxSep() {
	const sep = document.createElement('div')
	sep.className = 'ctx-sep'
	return sep
}

function openContextMenu(x, y, node) {
	closeContextMenu()
	const menu = document.createElement('div')
	menu.className = 'ctx-menu'

	if (!node) {
		menu.appendChild(
			ctxItem('ri-file-add-line', 'Новый файл', () => createFile(project)),
		)
		menu.appendChild(
			ctxItem('ri-folder-add-line', 'Новая папка', () => createFolder(project)),
		)
	} else if (node.type === 'folder') {
		menu.appendChild(
			ctxItem('ri-file-add-line', 'Новый файл здесь', () => createFile(node)),
		)
		menu.appendChild(
			ctxItem('ri-folder-add-line', 'Новая папка здесь', () =>
				createFolder(node),
			),
		)
		menu.appendChild(ctxSep())
		menu.appendChild(
			ctxItem('ri-edit-line', 'Переименовать', () => startRename(node)),
		)
		menu.appendChild(
			ctxItem('ri-delete-bin-line', 'Удалить', () => requestDelete(node), true),
		)
	} else {
		menu.appendChild(
			ctxItem('ri-folder-open-line', 'Открыть', () => openFile(node.id)),
		)
		if (node.name.endsWith('.spark') && node.id !== entryFileId) {
			menu.appendChild(
				ctxItem('ri-flashlight-line', 'Сделать точкой входа', () =>
					setEntry(node),
				),
			)
		}
		menu.appendChild(ctxSep())
		menu.appendChild(
			ctxItem('ri-edit-line', 'Переименовать', () => startRename(node)),
		)
		menu.appendChild(
			ctxItem('ri-delete-bin-line', 'Удалить', () => requestDelete(node), true),
		)
	}

	document.body.appendChild(menu)
	const rect = menu.getBoundingClientRect()
	menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px'
	menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px'
	ctxMenuEl = menu
}
