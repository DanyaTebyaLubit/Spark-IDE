// ============================================================
//  Автокомплит (Ctrl+Space и подсказки при вводе)
// ============================================================

const AC_KEYWORDS = [
	{ label: 'page', insert: 'page ', desc: 'Объявление страницы', group: 'kw' },
	{
		label: 'import',
		insert: 'import ""',
		cursorAfter: 8,
		desc: 'Импорт .spark файла',
		group: 'kw',
	},
	{ label: 'on', insert: 'on ', desc: 'Обработчик события', group: 'kw' },
	{ label: 'let', insert: 'let ', desc: 'Переменная', group: 'kw' },
	{
		label: 'if',
		insert: 'if () {\n\n}',
		cursorAfter: 4,
		desc: 'Условие (внутри обработчика события)',
		group: 'kw',
	},
	{
		label: 'else',
		insert: 'else {\n\n}',
		cursorAfter: 6,
		desc: 'Иначе (внутри обработчика события)',
		group: 'kw',
	},
]

const AC_TAGS = [
	'div',
	'span',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'p',
	'button',
	'input',
	'textarea',
	'select',
	'option',
	'img',
	'a',
	'ul',
	'ol',
	'li',
	'label',
	'form',
	'header',
	'footer',
	'nav',
	'section',
	'article',
	'strong',
	'em',
	'br',
	'hr',
].map(t => ({ label: t, insert: t, desc: 'HTML-тег', group: 'tag' }))

const AC_STYLE_ATTRS = [
	['bg', 'фон — background'],
	['c', 'цвет текста — color'],
	['p', 'внутренний отступ — padding'],
	['m', 'внешний отступ — margin'],
	['radius', 'скругление углов — border-radius'],
	['w', 'ширина — width'],
	['h', 'высота — height'],
	['border', 'граница'],
	['shadow', 'тень — box-shadow'],
	['gap', 'зазор между flex-элементами'],
	['font', 'размер шрифта — font-size'],
	['align', 'выравнивание по поперечной оси — align-items'],
	['justify', 'выравнивание по главной оси — justify-content'],
	['direction', 'направление flex — flex-direction'],
	['cursor', 'курсор мыши'],
	['opacity', 'прозрачность'],
	['z', 'z-index'],
	['flex', 'display: flex'],
	['center', 'flex + центрирование по обеим осям'],
	['text', 'текст элемента'],
	['placeholder', 'подсказка в поле ввода'],
].map(([k, d]) => ({ label: k, insert: k + ': ', desc: d, group: 'attr' }))

const AC_EVENTS = [
	['load', 'запускается при открытии страницы', false],
	['click', 'клик по элементу', true],
	['input', 'значение поля меняется во время ввода', true],
	['change', 'значение поля изменилось', true],
	['submit', 'отправка формы', true],
	['mouseenter', 'курсор наведён на элемент', true],
	['mouseleave', 'курсор ушёл с элемента', true],
	['keydown', 'нажатие клавиши', true],
	['dblclick', 'двойной клик', true],
	['focus', 'элемент получил фокус', true],
	['blur', 'элемент потерял фокус', true],
].map(([name, desc, needsSelector]) => {
	const insert = needsSelector ? `${name}() {\n\n}` : `${name} {\n\n}`
	const cursorAfter = needsSelector ? name.length + 1 : insert.indexOf('\n') + 1
	return { label: name, insert, cursorAfter, desc, group: 'event' }
})

const AC_ACTIONS = [
	['select', 'найти элемент — select(#id)'],
	[
		'value',
		'прочитать/установить значение поля — value(#id) или value(#id, "текст")',
	],
	['text', 'прочитать/установить текст — text(#id) или text(#id, "текст")'],
	['html', 'прочитать/установить HTML — html(#id, "<b>жирный</b>")'],
	['css', 'задать CSS-свойство — css(#id, "background", "red")'],
	['hide', 'скрыть элемент — hide(#id)'],
	['show', 'показать элемент — show(#id)'],
	['toggle', 'показать/скрыть элемент — toggle(#id)'],
	['print', 'вывести в консоль разработчика — print("привет", x)'],
].map(([name, desc]) => ({
	label: name,
	insert: `${name}()`,
	cursorAfter: name.length + 1,
	desc,
	group: 'action',
}))

// ------------------------------------------------------------
//  Автокомплит для настоящего CSS (файлы .spstyle)
// ------------------------------------------------------------
const AC_CSS_PROPS = [
	['color', 'цвет текста'],
	['background', 'фон (сокращённая запись)'],
	['background-color', 'цвет фона'],
	['padding', 'внутренний отступ'],
	['margin', 'внешний отступ'],
	['border', 'граница'],
	['border-radius', 'скругление углов'],
	['width', 'ширина'],
	['height', 'высота'],
	['max-width', 'максимальная ширина'],
	['min-width', 'минимальная ширина'],
	['display', 'тип отображения элемента'],
	['flex', 'flex-параметры элемента'],
	['flex-direction', 'направление flex-контейнера'],
	['align-items', 'выравнивание по поперечной оси'],
	['justify-content', 'выравнивание по главной оси'],
	['gap', 'зазор между flex/grid-элементами'],
	['font-size', 'размер шрифта'],
	['font-weight', 'насыщенность шрифта'],
	['font-family', 'семейство шрифта'],
	['line-height', 'высота строки'],
	['text-align', 'выравнивание текста'],
	['text-decoration', 'подчёркивание/зачёркивание текста'],
	['position', 'способ позиционирования'],
	['top', 'отступ от верхнего края'],
	['left', 'отступ от левого края'],
	['right', 'отступ от правого края'],
	['bottom', 'отступ от нижнего края'],
	['overflow', 'обрезка выходящего содержимого'],
	['opacity', 'прозрачность'],
	['transition', 'плавная анимация свойств'],
	['cursor', 'курсор мыши'],
	['box-shadow', 'тень блока'],
	['z-index', 'порядок наложения элементов'],
	['transform', 'трансформация (сдвиг/поворот/масштаб)'],
].map(([name, desc]) => ({
	label: name,
	insert: name + ': ',
	desc,
	group: 'attr',
}))

const AC_CSS_VALUES = [
	['flex', 'display: flex'],
	['block', 'display: block'],
	['grid', 'display: grid'],
	['none', 'скрыть / отключить'],
	['inline-block', 'display: inline-block'],
	['center', 'выравнивание по центру'],
	['flex-start', 'выравнивание в начало'],
	['flex-end', 'выравнивание в конец'],
	['space-between', 'равномерно, с промежутком между'],
	['space-around', 'равномерно, с промежутком по краям'],
	['absolute', 'position: absolute'],
	['relative', 'position: relative'],
	['fixed', 'position: fixed'],
	['pointer', 'cursor: pointer'],
	['hidden', 'overflow: hidden'],
	['auto', 'автоматическое значение'],
	['bold', 'font-weight: bold'],
	['uppercase', 'text-transform: uppercase'],
	['ease', 'transition-timing-function: ease'],
].map(([name, desc]) => ({
	label: name,
	insert: name,
	desc,
	group: 'ref',
}))

const AC_CSS_PSEUDO = [
	['hover', 'наведение курсора'],
	['focus', 'элемент в фокусе'],
	['active', 'элемент активен (нажат)'],
	['disabled', 'элемент отключён'],
	['first-child', 'первый дочерний элемент'],
	['last-child', 'последний дочерний элемент'],
	['nth-child', 'n-й дочерний элемент'],
	['not', 'исключение по селектору'],
	['before', 'псевдоэлемент ::before'],
	['after', 'псевдоэлемент ::after'],
].map(([name, desc]) => ({
	label: name,
	insert: name,
	desc,
	group: 'event',
}))

function acCurrentFileIsCss() {
	if (typeof activeTabId === 'undefined' || !activeTabId) return false
	if (typeof findNode !== 'function') return false
	const found = findNode(activeTabId)
	return !!(
		found &&
		found.node &&
		found.node.name &&
		found.node.name.endsWith('.spstyle')
	)
}

function acGetCssContext(linePrefix, pos) {
	// значение свойства: "color: b" (двоеточие + пробел уже введены)
	let m = linePrefix.match(/:\s+([\w-]*)$/)
	if (m) {
		const start = pos - m[1].length
		return { items: AC_CSS_VALUES, prefix: m[1], start, end: pos }
	}

	// псевдокласс/псевдоэлемент сразу у селектора: "a:h" или "div::be"
	m = linePrefix.match(/:{1,2}([\w-]*)$/)
	if (m) {
		const start = pos - m[1].length
		return { items: AC_CSS_PSEUDO, prefix: m[1], start, end: pos }
	}

	// иначе — предлагаем CSS-свойства
	m = linePrefix.match(/[\w-]*$/)
	const word = m ? m[0] : ''
	if (!word) return null
	const start = pos - word.length
	return { items: AC_CSS_PROPS, prefix: word, start, end: pos }
}

const AC_GROUP_ICON = {
	kw: 'ri-braces-line',
	tag: 'ri-code-s-slash-line',
	attr: 'ri-brush-line',
	event: 'ri-flashlight-line',
	action: 'ri-function-line',
	ref: 'ri-hashtag',
}

let acEl = null
let acItems = []
let acIndex = 0
let acRange = null // { start, end } диапазон в editorArea.value, который заменяем при выборе

function acCollectExisting(prefixChar) {
	const value = editorArea.value
	const re = prefixChar === '#' ? /#([\w-]+)/g : /\.([\w-]+)/g
	const set = new Set()
	let m
	while ((m = re.exec(value))) set.add(m[1])
	return [...set].sort().map(name => ({
		label: prefixChar + name,
		insert: prefixChar + name,
		desc:
			prefixChar === '#'
				? 'существующий id на странице'
				: 'существующий класс на странице',
		group: 'ref',
	}))
}

function acGetContext() {
	if (editorArea.selectionStart !== editorArea.selectionEnd) return null
	const pos = editorArea.selectionStart
	const value = editorArea.value
	const lineStart = value.lastIndexOf('\n', pos - 1) + 1
	const linePrefix = value.slice(lineStart, pos)

	// в файлах .spstyle работаем как с обычным CSS, а не со Spark-синтаксисом
	if (acCurrentFileIsCss()) return acGetCssContext(linePrefix, pos)

	// после "on " — подсказать имена событий
	let m = linePrefix.match(/(^|\s)on\s+(\w*)$/)
	if (m) {
		const start = pos - m[2].length
		return { items: AC_EVENTS, prefix: m[2], start, end: pos }
	}

	// ссылка вида #id
	m = linePrefix.match(/#([\w-]*)$/)
	if (m) {
		const start = pos - m[1].length - 1
		return {
			items: acCollectExisting('#'),
			prefix: '#' + m[1],
			start,
			end: pos,
		}
	}

	// ссылка вида .class — либо после разделителя, либо в начале (отступ + точка) строки тега
	m = linePrefix.match(/(?:^[ \t]*|[\s(,])\.(\w*)$/)
	if (m) {
		const start = pos - m[1].length - 1
		return {
			items: acCollectExisting('.'),
			prefix: '.' + m[1],
			start,
			end: pos,
		}
	}

	// текущее «слово» под курсором. В новом синтаксисе и селекторы тегов,
	// и свойства (key: value) пишутся каждый на своей строке — поэтому
	// предлагаем единый набор: теги, свойства/стили, ключевые слова и
	// функции рантайма, независимо от позиции в строке.
	m = linePrefix.match(/[\w-]*$/)
	const word = m ? m[0] : ''
	const start = pos - word.length
	if (!word) return null

	return {
		items: [...AC_KEYWORDS, ...AC_TAGS, ...AC_STYLE_ATTRS, ...AC_ACTIONS],
		prefix: word,
		start,
		end: pos,
	}
}

function acFilter(items, prefix) {
	const lower = prefix.toLowerCase()
	return items
		.filter(
			it =>
				it.label.toLowerCase().startsWith(lower) &&
				it.label.toLowerCase() !== lower,
		)
		.slice(0, 40)
}

function acGetCaretCoords(position) {
	const el = editorArea
	const style = getComputedStyle(el)
	const mirror = document.createElement('div')
	const props = [
		'boxSizing',
		'width',
		'paddingTop',
		'paddingRight',
		'paddingBottom',
		'paddingLeft',
		'borderTopWidth',
		'borderRightWidth',
		'borderBottomWidth',
		'borderLeftWidth',
		'fontStyle',
		'fontVariant',
		'fontWeight',
		'fontSize',
		'lineHeight',
		'fontFamily',
		'letterSpacing',
		'tabSize',
		'whiteSpace',
		'wordBreak',
	]
	mirror.style.position = 'absolute'
	mirror.style.visibility = 'hidden'
	mirror.style.whiteSpace = 'pre-wrap'
	mirror.style.wordWrap = 'break-word'
	mirror.style.top = '0'
	mirror.style.left = '-9999px'
	props.forEach(p => {
		mirror.style[p] = style[p]
	})
	mirror.style.width = el.clientWidth + 'px'
	document.body.appendChild(mirror)

	mirror.textContent = el.value.slice(0, position)
	const span = document.createElement('span')
	span.textContent = el.value.slice(position)[0] || '.'
	mirror.appendChild(span)

	const elRect = el.getBoundingClientRect()
	const mirrorRect = mirror.getBoundingClientRect()
	const spanRect = span.getBoundingClientRect()
	const lineHeight = parseFloat(style.lineHeight) || 20

	const top =
		elRect.top + (spanRect.top - mirrorRect.top) - el.scrollTop + lineHeight
	const left = elRect.left + (spanRect.left - mirrorRect.left) - el.scrollLeft

	document.body.removeChild(mirror)
	return { top, left, lineHeight }
}

function acClose() {
	if (acEl) {
		acEl.remove()
		acEl = null
	}
	acItems = []
	acRange = null
}

function acApply(item) {
	if (!acRange) return
	const value = editorArea.value
	const insert = item.insert
	editorArea.value =
		value.slice(0, acRange.start) + insert + value.slice(acRange.end)
	const cursor =
		acRange.start +
		(item.cursorAfter !== undefined ? item.cursorAfter : insert.length)
	editorArea.selectionStart = editorArea.selectionEnd = cursor
	acClose()
	commitEditorChange()
	editorArea.focus()
}

function acRender() {
	if (!acEl) {
		acEl = document.createElement('div')
		acEl.className = 'ac-popup'
		document.body.appendChild(acEl)
	}
	acEl.innerHTML = ''
	acItems.forEach((item, i) => {
		const row = document.createElement('div')
		row.className = 'ac-item' + (i === acIndex ? ' selected' : '')
		row.innerHTML = `<i class="${AC_GROUP_ICON[item.group] || 'ri-code-line'}"></i>
			<span class="ac-label">${escapeHtml(item.label)}</span>
			<span class="ac-desc">${escapeHtml(item.desc || '')}</span>`
		row.addEventListener('mousedown', e => {
			e.preventDefault()
			acApply(item)
		})
		row.addEventListener('mouseenter', () => {
			acIndex = i
			acRender()
		})
		acEl.appendChild(row)
	})

	const coords = acGetCaretCoords(acRange.start)
	acEl.style.top = coords.top + 'px'
	acEl.style.left = coords.left + 'px'

	const rect = acEl.getBoundingClientRect()
	if (rect.bottom > window.innerHeight) {
		acEl.style.top = coords.top - rect.height - coords.lineHeight + 'px'
	}
	if (rect.right > window.innerWidth) {
		acEl.style.left = Math.max(4, window.innerWidth - rect.width - 8) + 'px'
	}
}

function acOpen() {
	const ctx = acGetContext()
	if (!ctx) {
		acClose()
		return
	}
	// ctx.prefix уже включает символ # / . там, где он есть — сравниваем как есть
	const items = acFilter(ctx.items, ctx.prefix)
	if (!items.length) {
		acClose()
		return
	}
	acItems = items
	acIndex = 0
	acRange = { start: ctx.start, end: ctx.end }
	acRender()
}

function acIsOpen() {
	return !!acEl
}

function initAutocomplete() {
	// Регистрируем keydown ПЕРВЫМ, чтобы перехватывать Enter/Tab/стрелки
	// раньше остальных обработчиков редактора (см. порядок <script> в index.html).
	editorArea.addEventListener('keydown', e => {
		if (
			e.ctrlKey &&
			!e.shiftKey &&
			!e.altKey &&
			(e.code === 'Space' || e.key === ' ')
		) {
			e.preventDefault()
			e.stopImmediatePropagation()
			acOpen()
			return
		}
		if (!acIsOpen()) return
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			e.stopImmediatePropagation()
			acIndex = (acIndex + 1) % acItems.length
			acRender()
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			e.stopImmediatePropagation()
			acIndex = (acIndex - 1 + acItems.length) % acItems.length
			acRender()
		} else if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault()
			e.stopImmediatePropagation()
			acApply(acItems[acIndex])
		} else if (e.key === 'Escape') {
			e.preventDefault()
			e.stopImmediatePropagation()
			acClose()
		}
	})

	editorArea.addEventListener('input', () => {
		const pos = editorArea.selectionStart
		const before = editorArea.value.slice(0, pos)
		const lastChar = before.slice(-1)
		if (/[\w#.-]/.test(lastChar)) {
			acOpen()
		} else {
			acClose()
		}
	})

	editorArea.addEventListener('blur', () => setTimeout(acClose, 120))
	editorArea.addEventListener('scroll', acClose)
	window.addEventListener('resize', acClose)
}
