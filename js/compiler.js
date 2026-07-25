// ============================================================
//  Компилятор Spark (.spark) + Поддержка ресурсов и импортов
//
//  Новый синтаксис (фигурные скобки вместо отступов):
//
//    selector { key: value ... вложенные_теги { ... } }
//
//  Каждое свойство/атрибут — на отдельной строке вида "key: value".
//  Вложенные теги — это блоки "selector { ... }" внутри родителя.
//  Текст элемента задаётся спец-свойством "text: ...".
//  Обработчики событий — "on click(#id) { ...обычный JS... }": внутри
//  события можно писать настоящий JS с настоящими { } (if/for/function
//  и т.д.), т.к. границы блока уже даёт сама фигурная скобка.
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

// ------------------------------------------------------------
//  Разбор исходника на плоский список узлов верхнего уровня:
//  { type: 'line', text, lineNo }               — одиночная строка
//  { type: 'block', header, lineNo, body }       — "header { ... }"
//  Умеет пропускать // комментарии и строки в кавычках (", ', `),
//  а фигурные скобки внутри них не считаются за границы блока.
// ------------------------------------------------------------
function isQuoteChar(ch) {
	return ch === '"' || ch === "'" || ch === '`'
}

function splitIntoNodes(source) {
	const nodes = []
	let i = 0
	let line = 1
	let buf = ''
	let bufLine = 1

	function flushLine() {
		const trimmed = buf.trim()
		buf = ''
		if (trimmed && !trimmed.startsWith('//')) {
			nodes.push({ type: 'line', text: trimmed, lineNo: bufLine })
		}
	}

	while (i < source.length) {
		const ch = source[i]

		if (ch === '\n') {
			flushLine()
			line++
			bufLine = line
			i++
			continue
		}

		if (isQuoteChar(ch)) {
			if (buf === '') bufLine = line
			const quote = ch
			buf += ch
			i++
			while (i < source.length) {
				if (source[i] === '\n') line++
				buf += source[i]
				if (source[i] === quote && source[i - 1] !== '\\') {
					i++
					break
				}
				i++
			}
			continue
		}

		if (ch === '/' && source[i + 1] === '/') {
			while (i < source.length && source[i] !== '\n') i++
			continue
		}

		if (ch === '{') {
			const headerText = buf.trim()
			const headerLine = bufLine
			buf = ''
			let depth = 1
			let j = i + 1
			let inQuote = null
			while (j < source.length && depth > 0) {
				const c = source[j]
				if (c === '\n') line++
				if (inQuote) {
					if (c === inQuote && source[j - 1] !== '\\') inQuote = null
					j++
					continue
				}
				if (isQuoteChar(c)) {
					inQuote = c
					j++
					continue
				}
				if (c === '/' && source[j + 1] === '/') {
					while (j < source.length && source[j] !== '\n') j++
					continue
				}
				if (c === '{') depth++
				else if (c === '}') {
					depth--
					if (depth === 0) break
				}
				j++
			}
			if (depth !== 0) {
				throw new Error(
					`Строка ${headerLine}: не найдена закрывающая "}" для "${headerText} {"`,
				)
			}
			const body = source.slice(i + 1, j)
			nodes.push({ type: 'block', header: headerText, lineNo: headerLine, body })
			i = j + 1
			bufLine = line
			continue
		}

		if (buf === '') bufLine = line
		buf += ch
		i++
	}
	flushLine()
	return nodes
}

function parseSelectorHeader(header) {
	const str = header.trim()
	const selMatch = str.match(/^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)(?:#([\w-]+))?$/)
	if (!selMatch) return null
	if (!selMatch[1] && !selMatch[2] && !selMatch[3]) return null
	return {
		tagName: selMatch[1] || 'div',
		classes: (selMatch[2] || '').split('.').filter(Boolean),
		id: selMatch[3] || null,
	}
}

const EVENT_RE = /^on\s+(\w+)(?:\(([^)]+)\))?\s*$/
const PAGE_RE = /^page\s+(\w+)\s*$/
const GLOBAL_LET_RE = /^let\s+([A-Za-z_$][\w$]*)\s*=\s*[\s\S]+$/

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

function unquote(val) {
	if (
		val.length >= 2 &&
		((val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'")))
	) {
		return val.slice(1, -1)
	}
	return val
}

// Разбирает тело тега (уже без внешних { }) на свойства/стили/текст/детей.
function parseTagBody(bodyNodes) {
	const attrs = [],
		styles = [],
		children = []
	let text_ = null

	for (const n of bodyNodes) {
		if (n.type === 'block') {
			const sel = parseSelectorHeader(n.header)
			if (!sel) {
				throw new Error(
					`Строка ${n.lineNo}: не могу разобрать вложенный тег "${n.header} {...}"`,
				)
			}
			const inner = parseTagBody(splitIntoNodes(n.body))
			children.push({
				kind: 'tag',
				tagName: sel.tagName,
				classes: sel.classes,
				id: sel.id,
				lineNo: n.lineNo,
				attrs: inner.attrs,
				styles: inner.styles,
				text_: inner.text_,
				children: inner.children,
			})
			continue
		}

		const text = n.text
		if (text === 'flex') {
			styles.push({ key: 'display', val: 'flex' })
			continue
		}
		if (text === 'center') {
			styles.push(
				{ key: 'display', val: 'flex' },
				{ key: 'align-items', val: 'center' },
				{ key: 'justify-content', val: 'center' },
			)
			continue
		}

		const idx = text.indexOf(':')
		if (idx === -1) {
			attrs.push({ key: text, val: null })
			continue
		}
		const key = text.slice(0, idx).trim()
		const val = unquote(text.slice(idx + 1).trim())
		const lowerKey = key.toLowerCase()

		if (lowerKey === 'text') {
			text_ = val
		} else if (STYLE_SHORTHANDS[lowerKey]) {
			styles.push({ key: STYLE_SHORTHANDS[lowerKey], val })
		} else if (isLikelyCss(lowerKey)) {
			styles.push({ key, val })
		} else {
			attrs.push({ key, val })
		}
	}

	return { attrs, styles, text_, children }
}

function classifyPageNodes(nodes) {
	const result = []
	for (const node of nodes) {
		if (node.type === 'line') {
			if (GLOBAL_LET_RE.test(node.text)) {
				result.push({ kind: 'global-let', text: node.text })
				continue
			}
			throw new Error(`Строка ${node.lineNo}: не могу разобрать "${node.text}"`)
		}

		const evMatch = node.header.match(EVENT_RE)
		if (evMatch) {
			result.push({
				kind: 'event',
				eventName: evMatch[1],
				selector: evMatch[2] || null,
				lineNo: node.lineNo,
				jsBody: node.body,
			})
			continue
		}

		const sel = parseSelectorHeader(node.header)
		if (sel) {
			const inner = parseTagBody(splitIntoNodes(node.body))
			result.push({
				kind: 'tag',
				tagName: sel.tagName,
				classes: sel.classes,
				id: sel.id,
				lineNo: node.lineNo,
				attrs: inner.attrs,
				styles: inner.styles,
				text_: inner.text_,
				children: inner.children,
			})
			continue
		}

		throw new Error(`Строка ${node.lineNo}: не могу разобрать "${node.header} {...}"`)
	}
	return result
}

function escapeHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link'])

function tagToHtml(node) {
	const attrStrs = []

	if (node.classes.length) attrStrs.push(`class="${node.classes.join(' ')}"`)
	if (node.id) attrStrs.push(`id="${node.id}"`)

	for (const a of node.attrs) {
		let val = a.val
		if (a.key === 'src' && val) {
			const dataUrl = resolveVfsResource(val)
			if (dataUrl && dataUrl.startsWith('data:')) val = dataUrl
		}

		if (val === null) attrStrs.push(a.key)
		else attrStrs.push(`${a.key}="${escapeHtml(val)}"`)
	}

	if (node.styles.length) {
		const styleStr = node.styles.map(s => `${s.key}: ${s.val}`).join('; ')
		attrStrs.push(`style="${escapeHtml(styleStr)}"`)
	}

	const attrPart = attrStrs.length ? ' ' + attrStrs.join(' ') : ''
	const text = node.text_ !== null ? escapeHtml(node.text_) : ''
	const childrenHtml = node.children.map(tagToHtml).join('')

	if (VOID_TAGS.has(node.tagName)) return `<${node.tagName}${attrPart}>`
	return `<${node.tagName}${attrPart}>${text}${childrenHtml}</${node.tagName}>`
}

// Раскрываем сокращённую запись селектора ТОЛЬКО сразу после известных
// функций рантайма: select(#id) -> select("#id"), value(.cls) -> value(".cls").
// Замена триггерится только сразу после открывающей скобки нужной функции,
// поэтому произвольный JS (доступ к свойствам, числа с точкой и т.д.) не задевается.
const SELECTOR_SHORTHAND_FNS = [
	'select',
	'value',
	'text',
	'html',
	'css',
	'hide',
	'show',
	'toggle',
]
const SELECTOR_ARG_RE = new RegExp(
	'\\b(' + SELECTOR_SHORTHAND_FNS.join('|') + ')\\(\\s*(#[\\w-]+|\\.[\\w-]+)',
	'g',
)

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
			chunk = chunk.replace(
				SELECTOR_ARG_RE,
				(m, fn, sel) => `${fn}(${JSON.stringify(sel)}`,
			)
			out += chunk
			i = chunkEnd
		}
	}
	return out
}

function eventToJs(node) {
	const body = expandSelectors(node.jsBody).trim()
	if (node.eventName === 'load')
		return `window.addEventListener("DOMContentLoaded", () => {\n${body}\n});`
	if (!node.selector)
		return `// пропущен селектор для события ${node.eventName}`
	return `document.querySelector("${node.selector}")?.addEventListener("${node.eventName}", () => {\n${body}\n});`
}

function compileSpark(source, css, extraJs = '') {
	const preprocessed = preprocessSparkImports(source)
	const nodes = splitIntoNodes(preprocessed)

	let pageName = 'Page',
		startIdx = 0
	if (nodes.length && nodes[0].type === 'line' && PAGE_RE.test(nodes[0].text)) {
		pageName = nodes[0].text.match(PAGE_RE)[1]
		startIdx = 1
	}

	const bodyNodes = classifyPageNodes(nodes.slice(startIdx))

	const bodyHtml = bodyNodes
		.filter(n => n.kind === 'tag')
		.map(tagToHtml)
		.join('\n')

	const events = bodyNodes.filter(n => n.kind === 'event')
	const jsBody = events.map(eventToJs).join('\n\n')

	const globalLets = bodyNodes.filter(n => n.kind === 'global-let')
	const globalLetsJs = globalLets
		.map(
			n =>
				'// глобальная переменная уровня страницы\n' + expandSelectors(n.text),
		)
		.join('\n')

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
	const js =
		runtime +
		'\n' +
		(globalLetsJs ? globalLetsJs + '\n\n' : '') +
		jsBody +
		(extraJs ? '\n\n// --- Пользовательский JS (.spjs) ---\n' + extraJs : '')

	const indexHtml = `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${pageName}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n${bodyHtml}\n<script src="script.js"><\/script>\n</body>\n</html>`
	const previewHtml = `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${pageName}</title>\n<style>\nbody { margin: 0; font-family: system-ui, -apple-system, sans-serif; }\n${css}\n</style>\n</head>\n<body>\n${bodyHtml}\n<script>\n${js}\n<\/script>\n</body>\n</html>`

	return { pageName, indexHtml, css, js, previewHtml }
}
