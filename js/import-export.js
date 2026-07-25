// ============================================================
//  Импорт / Экспорт ZIP и Форматирование
// ============================================================

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportCompiledSite() {
	const { entryFile, cssCombined, jsCombined } = getEntryAndCss()
	if (!entryFile) {
		showError('В проекте нет ни одного .spark файла для экспорта.')
		return
	}
	try {
		const res = compileSpark(entryFile.content, cssCombined, jsCombined)
		const zip = new JSZip()
		zip.file('index.html', res.indexHtml)
		zip.file('style.css', res.css)
		zip.file('script.js', res.js)

		const blob = await zip.generateAsync({ type: 'blob' })
		downloadBlob(blob, `${res.pageName || 'SparkSite'}.zip`)
	} catch (e) {
		showError('Ошибка экспорта сайта: ' + e.message)
	}
}

async function exportProjectZip() {
	try {
		const zip = new JSZip()
		function addFolderToZip(folderNode, zipFolder) {
			for (const child of folderNode.children) {
				if (child.type === 'file') {
					if (child.isBinary && child.content.startsWith('data:')) {
						const base64Data = child.content.split(',')[1]
						zipFolder.file(child.name, base64Data, { base64: true })
					} else {
						zipFolder.file(child.name, child.content)
					}
				} else if (child.type === 'folder') {
					const nextZip = zipFolder.folder(child.name)
					addFolderToZip(child, nextZip)
				}
			}
		}
		addFolderToZip(project, zip)
		const blob = await zip.generateAsync({ type: 'blob' })
		downloadBlob(blob, `${project.name || 'spark-project'}.zip`)
	} catch (e) {
		showError('Ошибка сохранения проекта: ' + e.message)
	}
}

async function importProjectZip(file) {
	try {
		const zip = await JSZip.loadAsync(file)
		const newRoot = makeFolder('root', [])

		const filePaths = Object.keys(zip.files)
		for (const path of filePaths) {
			const zipEntry = zip.files[path]
			if (zipEntry.dir) continue

			const parts = path.split('/').filter(Boolean)
			let current = newRoot

			for (let i = 0; i < parts.length - 1; i++) {
				let folder = current.children.find(
					c => c.type === 'folder' && c.name === parts[i],
				)
				if (!folder) {
					folder = makeFolder(parts[i], [])
					current.children.push(folder)
				}
				current = folder
			}

			const fileName = parts[parts.length - 1]
			if (isImageExt(fileName)) {
				const base64 = await zipEntry.async('base64')
				const ext = fileName.split('.').pop().toLowerCase()
				const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
				current.children.push(
					makeFile(fileName, `data:${mime};base64,${base64}`, true),
				)
			} else {
				const text = await zipEntry.async('string')
				current.children.push(makeFile(fileName, text))
			}
		}

		if (newRoot.children.length > 0) {
			project = newRoot
			openTabs = []
			const sparks = findAllByExt('.spark')
			entryFileId = sparks[0] ? sparks[0].id : null
			activeTabId = entryFileId
			if (entryFileId) openTabs.push(entryFileId)

			processDynamicTheme()
			renderTree()
			renderTabs()
			syncEditor()
			run()
		}
	} catch (e) {
		showError('Ошибка импорта ZIP: ' + e.message)
	}
}

function formatCurrentFile() {
	const found = activeTabId ? findNode(activeTabId) : null
	if (!found || found.node.isBinary) return

	let code = editorArea.value
	if (found.node.name.endsWith('.json')) {
		try {
			const obj = JSON.parse(code)
			code = JSON.stringify(obj, null, 2)
		} catch (e) {
			showError('Ошибка форматирования JSON: некорректный синтаксис')
			return
		}
	} else {
		const lines = code.split('\n')
		code = lines.map(line => line.trimEnd()).join('\n')
	}

	editorArea.value = code
	found.node.content = code
	if (found.node.name === 'settings.json') processDynamicTheme()
	saveProjectToStorage()
	updateGutter()
	updateHighlighting()
	clearError()
}

