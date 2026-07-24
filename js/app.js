// ============================================================
//  Компилятор Spark (.spark) + Поддержка ресурсов и импортов
// ============================================================

function resolveFilePath(path, rootNode = project) {
	if (!path) return null
	const cleanPath = path.replace(/^\.\//, '').replace(/^\/+|\/+$/g, '')
	const parts = cleanPath.split('/')
	let curr = rootNode
	for (let i = 0; i < parts.length; i++) {
		const name = parts[i]
		if (curr && curr.type === 'folder') {
			const found = curr.children.find(c => c.name === name)
			if (!found) return null
			curr = found
		} else {
			return null
		}
	}
	return curr && curr.type === 'file' ? curr : null
}

function resolveVfsResource(pathStr) {
	const files = []
	walkFiles(project, '', files)
	const targetPath = pathStr.replace(/^\.\//, '')
	const found = files.find(
		([p, _]) => p === targetPath || p.endsWith('/' + targetPath),
	)
	return found ? found[1] : pathStr
}

function preprocessSparkImports(source, visited = new Set()) {
	const lines = source.split('\n')
	const processed = []

	for (let line of lines) {
		const match = line.trim().match(/^import\s+["']([^"']+)["']\s*$/)
		if (match) {
			const importPath = match[1]
			if (visited.has(importPath)) continue
			visited.add(importPath)

			const importedFile = resolveFilePath(importPath)
			if (importedFile) {
				let importedContent = importedFile.content
				// Удаляем директиву page из импортируемых файлов
				importedContent = importedContent.replace(/^page\s+\w+\s*$/gm, '')

				const nestedContent = preprocessSparkImports(importedContent, visited)
				processed.push(`// --- Import: ${importPath} ---`)
				processed.push(nestedContent)
			} else {
				throw new Error(`Не удалось найти импортируемый файл: "${importPath}"`)
			}
		} else {
			processed.push(line)
		}
	}
	return processed.join('\n')
}

function buildLineTree(source) {
	const rawLines = source
		.replace(/\r\n/g, '\n')
		.replace(/\u00a0/g, ' ')
		.split('\n')
	const lines = []
	rawLines.forEach((line, i) => {
		if (line.trim().length === 0) return
		if (line.trim().startsWith('//')) return
		const indent = (line.match(/^[ \t]*/) || [''])[0].length
		lines.push({ indent, text: line.trim(), lineNo: i + 1 })
	})

	const root = { children: [] }
	const stack = [{ indent: -1, node: root }]

	for (const line of lines) {
		const node = {
			indent: line.indent,
			text: line.text,
			lineNo: line.lineNo,
			children: [],
		}
		while (stack.length && line.indent <= stack[stack.length - 1].indent)
			stack.pop()
		stack[stack.length - 1].node.children.push(node)
		stack.push({ indent: line.indent, node })
	}
	return root.children
}

function splitSmart(str) {
	const result = []
	let current = '',
		inParen = 0,
		inQuote = false

	for (let i = 0; i < str.length; i++) {
		const char = str[i]
		if (char === '"' && str[i - 1] !== '\\') inQuote = !inQuote
		else if (char === '(' && !inQuote) inParen++
		else if (char === ')' && !inQuote) inParen--

		if (char === ',' && inParen === 0 && !inQuote) {
			result.push(current.trim())
			current = ''
		} else {
			current += char
		}
	}
	if (current.trim()) result.push(current.trim())
	return result
}

function parseTagLine(text) {
	let str = text.trim()
	let text_ = null
	let attrsRaw = null

	const quoteMatch = str.match(/\s*"([^"]*)"\s*$/)
	if (quoteMatch) {
		text_ = quoteMatch[1]
		str = str.slice(0, quoteMatch.index).trim()
	}

	if (str.endsWith(')')) {
		let parenDepth = 0,
			openIdx = -1
		for (let i = str.length - 1; i >= 0; i--) {
			if (str[i] === ')') parenDepth++
			else if (str[i] === '(') {
				parenDepth--
				if (parenDepth === 0) {
					openIdx = i
					break
				}
			}
		}
		if (openIdx !== -1) {
			attrsRaw = str.slice(openIdx + 1, str.length - 1).trim()
			str = str.slice(0, openIdx).trim()
		}
	}

	const selMatch = str.match(/^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)(?:#([\w-]+))?$/)
	if (!selMatch) return null

	return {
		tagName: selMatch[1] || 'div',
		classes: (selMatch[2] || '').split('.').filter(Boolean),
		id: selMatch[3] || null,
		attrsRaw,
		text_,
	}
}

const EVENT_RE = /^on\s+(\w+)(?:\(([^)]+)\))?\s*:\s*$/
const PAGE_RE = /^page\s+(\w+)\s*$/

function classify(nodes, insideEvent) {
	for (const node of nodes) {
		if (insideEvent) {
			node.kind = 'stmt'
			classify(node.children, true)
			continue
		}
		const evMatch = node.text.match(EVENT_RE)
		if (evMatch) {
			node.kind = 'event'
			node.eventName = evMatch[1]
			node.selector = evMatch[2] || null
			classify(node.children, true)
			continue
		}

		const parsed = parseTagLine(node.text)
		if (parsed) {
			node.kind = 'tag'
			node.tagName = parsed.tagName
			node.classes = parsed.classes
			node.id = parsed.id
			node.attrsRaw = parsed.attrsRaw
			node.text_ = parsed.text_
			classify(node.children, false)
			continue
		}
		throw new Error(`Строка ${node.lineNo}: не могу разобрать "${node.text}"`)
	}
}

function escapeHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link'])

const STYLE_SHORTHANDS = {
	bg: 'background',
	'bg-color': 'background-color',
	c: 'color',
	color: 'color',
	p: 'padding',
	m: 'margin',
	radius: 'border-radius',
	w: 'width',
	h: 'height',
	border: 'border',
	shadow: 'box-shadow',
	gap: 'gap',
	font: 'font-size',
	fs: 'font-size',
	align: 'align-items',
	justify: 'justify-content',
	direction: 'flex-direction',
	cursor: 'cursor',
	opacity: 'opacity',
	z: 'z-index',
}

function parseAttrsAndStyles(raw) {
	if (!raw) return { attrs: [], styles: [] }
	const items = splitSmart(raw)
	const attrs = [],
		styles = []

	for (const item of items) {
		if (item === 'flex') {
			styles.push({ key: 'display', val: 'flex' })
			continue
		}
		if (item === 'center') {
			styles.push(
				{ key: 'display', val: 'flex' },
				{ key: 'align-items', val: 'center' },
				{ key: 'justify-content', val: 'center' },
			)
			continue
		}

		const idx = item.indexOf(':')
		if (idx === -1) {
			attrs.push({ key: item, val: null })
			continue
		}

		let key = item.slice(0, idx).trim()
		let val = item.slice(idx + 1).trim()
		if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)

		const lowerKey = key.toLowerCase()
		if (STYLE_SHORTHANDS[lowerKey]) {
			styles.push({ key: STYLE_SHORTHANDS[lowerKey], val })
		} else if (isLikelyCss(lowerKey)) {
			styles.push({ key, val })
		} else {
			attrs.push({ key, val })
		}
	}
	return { attrs, styles }
}

function isLikelyCss(key) {
	const common = [
		'background',
		'color',
		'padding',
		'margin',
		'border',
		'width',
		'height',
		'top',
		'left',
		'right',
		'bottom',
		'position',
		'overflow',
		'display',
		'opacity',
		'transition',
		'flex',
	]
	return common.some(c => key.startsWith(c))
}

function tagToHtml(node) {
	const { attrs, styles } = parseAttrsAndStyles(node.attrsRaw)
	const attrStrs = []

	if (node.classes.length) attrStrs.push(`class="${node.classes.join(' ')}"`)
	if (node.id) attrStrs.push(`id="${node.id}"`)

	for (const a of attrs) {
		let val = a.val
		if (a.key === 'src' && val) {
			const dataUrl = resolveVfsResource(val)
			if (dataUrl && dataUrl.startsWith('data:')) val = dataUrl
		}

		if (val === null) attrStrs.push(a.key)
		else attrStrs.push(`${a.key}="${escapeHtml(val)}"`)
	}

	if (styles.length) {
		const styleStr = styles.map(s => `${s.key}: ${s.val}`).join('; ')
		attrStrs.push(`style="${escapeHtml(styleStr)}"`)
	}

	const attrPart = attrStrs.length ? ' ' + attrStrs.join(' ') : ''
	const text = node.text_ !== null ? escapeHtml(node.text_) : ''
	const childrenHtml = node.children
		.filter(c => c.kind === 'tag')
		.map(tagToHtml)
		.join('')

	if (VOID_TAGS.has(node.tagName)) return `<${node.tagName}${attrPart}>`
	return `<${node.tagName}${attrPart}>${text}${childrenHtml}</${node.tagName}>`
}

function expandSelectors(code) {
	let out = '',
		i = 0
	while (i < code.length) {
		if (code[i] === '"') {
			const end = code.indexOf('"', i + 1)
			if (end === -1) {
				out += code.slice(i)
				break
			}
			out += code.slice(i, end + 1)
			i = end + 1
		} else {
			const nextQuote = code.indexOf('"', i)
			const chunkEnd = nextQuote === -1 ? code.length : nextQuote
			let chunk = code.slice(i, chunkEnd)
			chunk = chunk.replace(/(?<![\w.])#([\w-]+)/g, '"#$1"')
			chunk = chunk.replace(/(?<![\w.])\.([a-zA-Z][\w-]*)/g, '".$1"')
			out += chunk
			i = chunkEnd
		}
	}
	return out
}

function collectEvents(nodes, acc) {
	for (const node of nodes) {
		if (node.kind === 'event') acc.push(node)
		collectEvents(node.children, acc)
	}
}

function stmtLines(node) {
	const lines = [expandSelectors(node.text)]
	for (const child of node.children) lines.push(...stmtLines(child))
	return lines
}

function eventToJs(node) {
	const body = node.children
		.map(c => '  ' + stmtLines(c).join('\n  '))
		.join('\n')
	if (node.eventName === 'load')
		return `window.addEventListener("DOMContentLoaded", () => {\n${body}\n});`
	if (!node.selector)
		return `// пропущен селектор для события ${node.eventName}`
	return `document.querySelector("${node.selector}")?.addEventListener("${node.eventName}", () => {\n${body}\n});`
}

function compileSpark(source, css) {
	const preprocessed = preprocessSparkImports(source)
	const lines = buildLineTree(preprocessed)
	let pageName = 'Page',
		startIdx = 0
	if (lines.length && PAGE_RE.test(lines[0].text)) {
		pageName = lines[0].text.match(PAGE_RE)[1]
		startIdx = 1
	}
	const bodyNodes = lines.slice(startIdx)
	classify(bodyNodes, false)

	const bodyHtml = bodyNodes
		.filter(n => n.kind === 'tag')
		.map(tagToHtml)
		.join('\n')
	const events = []
	collectEvents(bodyNodes, events)
	const jsBody = events.map(eventToJs).join('\n\n')

	const runtime = `// --- Spark Runtime & Console Hook ---
(function() {
	function sendConsole(type, args) {
		try {
			const formatted = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)));
			window.parent.postMessage({ type: 'spark-console', level: type, args: formatted }, '*');
		} catch(e) {}
	}
	const _log = console.log, _warn = console.warn, _err = console.error;
	console.log = function(...a) { _log.apply(console, a); sendConsole('log', a); };
	console.warn = function(...a) { _warn.apply(console, a); sendConsole('warn', a); };
	console.error = function(...a) { _err.apply(console, a); sendConsole('error', a); };
	window.onerror = function(msg, url, line, col, err) {
		sendConsole('error', [\`Ошибка (\${line}:\${col || 0}): \${msg}\`]);
	};
})();

function select(s) { return document.querySelector(s); }
function value(s, v) { const el = select(s); if (!el) return ""; if (v !== undefined) { el.value = v; return v; } return el.value; }
function text(s, t) { const el = select(s); if (!el) return ""; if (t !== undefined) { el.innerText = t; return t; } return el.innerText; }
function html(s, h) { const el = select(s); if (!el) return ""; if (h !== undefined) { el.innerHTML = h; return h; } return el.innerHTML; }
function css(s, prop, val) { const el = select(s); if (el) el.style[prop] = val; }
function hide(s) { const el = select(s); if (el) el.style.display = "none"; }
function show(s, d = "block") { const el = select(s); if (el) el.style.display = d; }
function toggle(s) { const el = select(s); if (el) el.style.display = (el.style.display === "none") ? "block" : "none"; }
function print(...args) { console.log(...args); }
`
	const js = runtime + '\n' + jsBody

	const indexHtml = `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${pageName}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n${bodyHtml}\n<script src="script.js"><\/script>\n</body>\n</html>`
	const previewHtml = `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${pageName}</title>\n<style>\nbody { margin: 0; font-family: system-ui, -apple-system, sans-serif; }\n${css}\n</style>\n</head>\n<body>\n${bodyHtml}\n<script>\n${js}\n<\/script>\n</body>\n</html>`

	return { pageName, indexHtml, css, js, previewHtml }
}

// ============================================================
//  Виртуальная файловая система проекта, Ресурсы и Автосохранение
// ============================================================

let uid = 0
const newId = () => 'n' + ++uid

function makeFile(name, content = '', isBinary = false) {
	return { id: newId(), type: 'file', name, content, isBinary }
}
function makeFolder(name, children = [], open = true) {
	return { id: newId(), type: 'folder', name, children, open }
}

function isImageExt(name) {
	return /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(name)
}

const DEFAULT_SPARK = `page SparkApp

import "components/header.spark"

.container (bg: #0f172a, c: #f8fafc, p: 40px, radius: 16px, shadow: 0 20px 40px rgba(0,0,0,0.4), m: 40px auto, w: 90%, max-width: 480px)
  h1 (c: #38bdf8, m: 0 0 10px 0, font: 24px) "Spark IDE — Быстрый Старт"
  p (c: #94a3b8, m: 0 0 24px 0) "Дизайн и логика в одном файле без лишнего кода!"

  .card (bg: #1e293b, p: 20px, radius: 12px, border: 1px solid #334155, m: 0 0 20px 0)
    input#nameInput (placeholder: "Ваше имя...", bg: #0f172a, c: white, p: 12px, radius: 8px, border: 1px solid #475569, w: 100%)
    
  .row (flex, gap: 12px)
    button#greetBtn (bg: #3b82f6, c: white, p: 12px 20px, radius: 8px, border: none, cursor: pointer, w: 100%) "Поздороваться"
    button#resetBtn (bg: #334155, c: white, p: 12px 20px, radius: 8px, border: none, cursor: pointer) "Сброс"

  .result#output (bg: #0284c7, c: white, p: 14px, radius: 8px, m: 20px 0 0 0) "Результат появится здесь..."

on click(#greetBtn):
  let name = value(#nameInput)
  if (!name) name = "Друг"
  text(#output, "Привет, " + name + "! 👋 Welcome to Spark.")
  css(#output, "background", "#10b981")
  print("Приветствие отправлено для:", name)

on click(#resetBtn):
  value(#nameInput, "")
  text(#output, "Результат появится здесь...")
  css(#output, "background", "#0284c7")
  print("Форма очищена.")

on load:
  print("Приложение успешно запущено!")
`
const DEFAULT_HEADER_COMPONENT = `// Шаблон компонента Header
.header-badge (bg: #1e1e2e, c: #8b7bff, p: 6px 12px, radius: 20px, font: 12px, m: 0 0 15px 0) "⚡ Компонент Header подключен"
`
const DEFAULT_STYLE = `/* Глобальные стили проекта */
body {
  background: #020617;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
button:hover {
  filter: brightness(1.1);
}
`
const DEFAULT_SETTINGS = `{
  "theme": {
    "colors": {
      "--bg": "#0b0c10",
      "--panel": "#14161c",
      "--panel-2": "#191c24",
      "--panel-3": "#101218",
      "--edge": "#24272f",
      "--text": "#e8e9f0",
      "--accent": "#8b7bff"
    },
    "syntax": {
      "--syn-keyword": "#ff7b72",
      "--syn-event": "#d2a8ff",
      "--syn-tag": "#79c0ff",
      "--syn-string": "#a5d6ff",
      "--syn-number": "#f2cc60",
      "--syn-comment": "#8b949e",
      "--syn-selector": "#7ee787",
      "--syn-prop": "#ffa657"
    }
  }
}`

let project = makeFolder('root', [
	makeFile('main.spark', DEFAULT_SPARK),
	makeFile('style.spstyle', DEFAULT_STYLE),
	makeFile('settings.json', DEFAULT_SETTINGS),
	makeFolder('components', [
		makeFile('header.spark', DEFAULT_HEADER_COMPONENT),
	]),
])

let entryFileId = project.children[0].id
let openTabs = [project.children[0].id]
let activeTabId = project.children[0].id
let selectedFolderId = project.id

// --- Темы и Настройки ---
function applySettingsConfig(content) {
	try {
		const config = JSON.parse(content)
		let css = ':root {\n'
		if (config.theme && config.theme.colors) {
			for (let [k, v] of Object.entries(config.theme.colors))
				css += `  ${k}: ${v};\n`
		}
		if (config.theme && config.theme.syntax) {
			for (let [k, v] of Object.entries(config.theme.syntax))
				css += `  ${k}: ${v};\n`
		}
		css += '}'
		document.getElementById('dynamic-theme').innerHTML = css
	} catch (e) {
		console.warn('Ошибка применения settings.json', e)
	}
}

function processDynamicTheme() {
	const files = []
	walkFiles(project, '', files)
	const settingsFile = files.find(f => f[0].endsWith('settings.json'))
	if (settingsFile) {
		applySettingsConfig(settingsFile[1])
	} else {
		document.getElementById('dynamic-theme').innerHTML = ''
	}
}

// --- АВТОСОХРАНЕНИЕ ---
function saveProjectToStorage() {
	localStorage.setItem('spark-project', JSON.stringify(project))
	localStorage.setItem('spark-openTabs', JSON.stringify(openTabs))
	localStorage.setItem('spark-activeTab', activeTabId || '')
	localStorage.setItem('spark-entryFileId', entryFileId || '')
	localStorage.setItem(
		'spark-theme',
		document.body.classList.contains('light-theme') ? 'light' : 'dark',
	)
	const btn = document.getElementById('saveProjectBtn')
	if (btn) {
		btn.classList.add('active')
		setTimeout(() => btn.classList.remove('active'), 300)
	}
}

function loadProjectFromStorage() {
	const storedProj = localStorage.getItem('spark-project')
	if (storedProj) {
		try {
			project = JSON.parse(storedProj)
			openTabs = JSON.parse(localStorage.getItem('spark-openTabs') || '[]')
			activeTabId = localStorage.getItem('spark-activeTab') || null
			entryFileId = localStorage.getItem('spark-entryFileId') || null

			let maxId = 0
			function findMaxId(node) {
				const idNum = parseInt(node.id.replace('n', '')) || 0
				if (idNum > maxId) maxId = idNum
				if (node.type === 'folder') node.children.forEach(findMaxId)
			}
			findMaxId(project)
			uid = maxId
			return true
		} catch (e) {
			console.error('Ошибка загрузки сохранения:', e)
		}
	}
	return false
}

function findNode(id, node = project, parent = null) {
	if (node.id === id) return { node, parent }
	if (node.type === 'folder') {
		for (const child of node.children) {
			const found = findNode(id, child, node)
			if (found) return found
		}
	}
	return null
}

function findAllByExt(ext, node = project, acc = []) {
	if (node.type === 'file') {
		if (node.name.endsWith(ext)) acc.push(node)
	} else {
		node.children.forEach(c => findAllByExt(ext, c, acc))
	}
	return acc
}

function walkFiles(node, prefix, out) {
	if (node.type === 'file') {
		out.push([prefix + node.name, node.content])
		return
	}
	const newPrefix = node === project ? prefix : prefix + node.name + '/'
	node.children.forEach(c => walkFiles(c, newPrefix, out))
}

function iconForFile(name) {
	if (name.endsWith('.spark')) return 'ri-flashlight-line spark-icon'
	if (name.endsWith('.spstyle')) return 'ri-paint-brush-line'
	if (name.endsWith('.json')) return 'ri-settings-4-line json-icon'
	if (name.endsWith('.html')) return 'ri-code-s-slash-line'
	if (isImageExt(name)) return 'ri-image-line img-icon'
	return 'ri-file-line'
}

function getEntryAndCss() {
	let entry = entryFileId ? findNode(entryFileId) : null
	if (
		!entry ||
		entry.node.type !== 'file' ||
		!entry.node.name.endsWith('.spark')
	) {
		const sparks = findAllByExt('.spark')
		entry = sparks[0] ? { node: sparks[0] } : null
		if (entry) entryFileId = entry.node.id
	}

	const cssFiles = findAllByExt('.spstyle')
	const cssCombined = cssFiles
		.map(f => `/* ${f.name} */\n` + f.content)
		.join('\n\n')

	return { entryFile: entry ? entry.node : null, cssCombined }
}

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

	return row
}

treeEl.addEventListener('contextmenu', e => {
	if (e.target !== treeEl) return
	e.preventDefault()
	selectedFolderId = project.id
	openContextMenu(e.clientX, e.clientY, null)
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
		return `page NewPage\n\n.card (bg: #1e1e2e, p: 20px, radius: 12px)\n  h1 "Новая страница"\n`
	if (name.endsWith('.spstyle')) return `/* новые стили */\n`
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

// ============================================================
//  Движок Подсветки Синтаксиса (Syntax Highlighting)
// ============================================================

function highlightSpark(code, isJson = false) {
	const htmlEscaped = escapeHtml(code)
	const lines = htmlEscaped.split('\n')

	const highlighted = lines.map(line => {
		if (isJson) {
			let l = line
			l = l.replace(/("[^"]*")(?=\s*:)/g, '<span class="tok-prop">$1</span>')
			l = l.replace(/:\s*("[^"]*")/g, ': <span class="tok-str">$1</span>')
			l = l.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="tok-num">$1</span>')
			return l
		}

		if (line.trim().startsWith('//'))
			return `<span class="tok-comment">${line}</span>`
		let l = line
		l = l.replace(
			/\b(page|import|let|if|else)\b/g,
			'<span class="tok-kw">$1</span>',
		)
		l = l.replace(/\b(on\s+\w+)/g, '<span class="tok-event">$1</span>')
		l = l.replace(/("[^"]*")/g, '<span class="tok-str">$1</span>')
		l = l.replace(/(\.[\w-]+)/g, '<span class="tok-sel">$1</span>')
		l = l.replace(/(#[\w-]+)/g, '<span class="tok-sel">$1</span>')
		l = l.replace(
			/\b(bg|c|color|p|m|radius|w|h|border|shadow|gap|font|fs|align|justify|direction|cursor|opacity|z)(?=:)/g,
			'<span class="tok-prop">$1</span>',
		)
		l = l.replace(/(#[\da-fA-F]{3,8})\b/g, '<span class="tok-num">$1</span>')
		return l
	})

	return highlighted.join('\n')
}

function updateHighlighting() {
	const found = activeTabId ? findNode(activeTabId) : null
	const code = editorArea.value

	if (
		found &&
		(found.node.name.endsWith('.spark') || found.node.name.endsWith('.spstyle'))
	) {
		highlightArea.querySelector('code').innerHTML =
			highlightSpark(code, false) + '\n'
	} else if (found && found.node.name.endsWith('.json')) {
		highlightArea.querySelector('code').innerHTML =
			highlightSpark(code, true) + '\n'
	} else {
		highlightArea.querySelector('code').innerHTML = escapeHtml(code) + '\n'
	}
}

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
	if (!found) {
		codeWrap.className = 'code-wrap no-file'
		editorArea.value = ''
		return
	}

	if (found.node.isBinary || isImageExt(found.node.name)) {
		codeWrap.className = 'code-wrap is-image'
		document.getElementById('imagePreviewTag').src = found.node.content
		document.getElementById('imagePreviewName').textContent = found.node.name
		return
	}

	codeWrap.className = 'code-wrap'
	editorArea.value = found.node.content
	updateGutter()
	updateHighlighting()
}

function updateGutter() {
	const lineCount = editorArea.value.split('\n').length
	let out = ''
	for (let i = 1; i <= lineCount; i++) out += i + '\n'
	gutterEl.textContent = out
	gutterEl.scrollTop = editorArea.scrollTop
}

editorArea.addEventListener('input', () => {
	const found = activeTabId ? findNode(activeTabId) : null
	if (found) {
		found.node.content = editorArea.value
		if (found.node.name === 'settings.json') processDynamicTheme()
		saveProjectToStorage()
	}
	updateGutter()
	updateHighlighting()
})

editorArea.addEventListener('scroll', () => {
	gutterEl.scrollTop = editorArea.scrollTop
	highlightArea.scrollTop = editorArea.scrollTop
	highlightArea.scrollLeft = editorArea.scrollLeft
})

editorArea.addEventListener('keydown', e => {
	if (e.key === 'Tab') {
		e.preventDefault()
		const start = editorArea.selectionStart,
			end = editorArea.selectionEnd
		editorArea.value =
			editorArea.value.slice(0, start) + '  ' + editorArea.value.slice(end)
		editorArea.selectionStart = editorArea.selectionEnd = start + 2
		const found = findNode(activeTabId)
		if (found) {
			found.node.content = editorArea.value
			saveProjectToStorage()
		}
		updateGutter()
		updateHighlighting()
	}
})

// ============================================================
//  Импорт / Экспорт ZIP и Форматирование
// ============================================================

function downloadBlob(blob, filename) {
	const a = document.createElement('a')
	a.href = URL.revokeObjectURL(blob) ? '' : URL.createObjectURL(blob)
	a.download = filename
	a.click()
	setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function exportCompiledSite() {
	const { entryFile, cssCombined } = getEntryAndCss()
	if (!entryFile) {
		showError('В проекте нет ни одного .spark файла для экспорта.')
		return
	}
	try {
		const res = compileSpark(entryFile.content, cssCombined)
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
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
			e.preventDefault()
			document.getElementById('sidebar').classList.toggle('collapsed')
		}
		if ((e.ctrlKey || e.metaKey) && e.key === '/') {
			e.preventDefault()
			document.getElementById('mainGrid').classList.toggle('no-preview')
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault()
			run()
		}
		if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
			e.preventDefault()
			formatCurrentFile()
		}
	})
}

// ============================================================
//  Запуск / компиляция / UI listeners
// ============================================================

function showError(message) {
	errbar.innerHTML = ''
	const icon = document.createElement('i')
	icon.className = 'ri-error-warning-line'
	const msg = document.createElement('span')
	msg.textContent = message
	errbar.appendChild(icon)
	errbar.appendChild(msg)
	errbar.style.display = 'flex'
}
function clearError() {
	errbar.style.display = 'none'
}

function run() {
	saveProjectToStorage()
	clearConsole()
	const { entryFile, cssCombined } = getEntryAndCss()
	if (!entryFile) {
		showError('В проекте нет ни одного .spark файла для запуска.')
		return
	}
	try {
		const result = compileSpark(entryFile.content, cssCombined)
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
