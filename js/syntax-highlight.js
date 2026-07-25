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
			/\b(page|import|let|const|var|if|else|for|while|do|function|return|try|catch|finally|switch|case|default|break|continue|new|typeof)\b/g,
			'<span class="tok-kw">$1</span>',
		)
		l = l.replace(/\b(on\s+\w+)/g, '<span class="tok-event">$1</span>')
		l = l.replace(/("[^"]*")/g, '<span class="tok-str">$1</span>')
		l = l.replace(/(\.[\w-]+)/g, '<span class="tok-sel">$1</span>')
		l = l.replace(/(#[\w-]+)/g, '<span class="tok-sel">$1</span>')
		l = l.replace(
			/\b(text|bg|c|color|p|m|radius|w|h|border|shadow|gap|font|fs|align|justify|direction|cursor|opacity|z)(?=\s*:)/g,
			'<span class="tok-prop">$1</span>',
		)
		l = l.replace(/(#[\da-fA-F]{3,8})\b/g, '<span class="tok-num">$1</span>')
		return l
	})

	return highlighted.join('\n')
}

// ------------------------------------------------------------
//  Подсветка обычного CSS (используется файлами .spstyle)
// ------------------------------------------------------------
function highlightCss(code) {
	const escaped = escapeHtml(code)

	// Единый проход по токенам: комментарии /* */, строки, @-правила,
	// hex-цвета, числа с единицами, селекторы (перед {), свойства (перед :),
	// псевдоклассы/псевдоэлементы.
	const tokenRe =
		/(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr)?\b)|([.#&]?[\w-]+(?=[\s.:#\w-]*\{))|([\w-]+)(?=\s*:)|(::?[\w-]+)/g

	let out = ''
	let last = 0
	let m
	while ((m = tokenRe.exec(escaped))) {
		out += escaped.slice(last, m.index)
		last = tokenRe.lastIndex
		if (m[1]) out += `<span class="tok-comment">${m[1]}</span>`
		else if (m[2] || m[3]) out += `<span class="tok-str">${m[0]}</span>`
		else if (m[4]) out += `<span class="tok-kw">${m[4]}</span>`
		else if (m[5]) out += `<span class="tok-num">${m[5]}</span>`
		else if (m[6]) out += `<span class="tok-num">${m[6]}</span>`
		else if (m[7]) out += `<span class="tok-sel">${m[7]}</span>`
		else if (m[8]) out += `<span class="tok-prop">${m[8]}</span>`
		else if (m[9]) out += `<span class="tok-event">${m[9]}</span>`
		else out += m[0]
	}
	out += escaped.slice(last)
	return out
}

// ------------------------------------------------------------
//  Подсветка обычного JavaScript (используется файлами .spjs)
// ------------------------------------------------------------
function highlightJs(code) {
	const escaped = escapeHtml(code)

	const tokenRe =
		/(\/\/.*)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)|\b(function|return|if|else|for|while|let|const|var|new|typeof|true|false|null|undefined|break|continue|switch|case|default|try|catch|finally|throw|class|extends|super|this|await|async|of|in|do|delete|instanceof|void|yield)\b|(-?\b\d+\.?\d*\b)/g

	let out = ''
	let last = 0
	let m
	while ((m = tokenRe.exec(escaped))) {
		out += escaped.slice(last, m.index)
		last = tokenRe.lastIndex
		if (m[1]) out += `<span class="tok-comment">${m[1]}</span>`
		else if (m[2] || m[3] || m[4]) out += `<span class="tok-str">${m[0]}</span>`
		else if (m[5]) out += `<span class="tok-kw">${m[5]}</span>`
		else if (m[6]) out += `<span class="tok-num">${m[6]}</span>`
		else out += m[0]
	}
	out += escaped.slice(last)
	return out
}

function updateHighlighting() {
	const found = activeTabId ? findNode(activeTabId) : null
	const code = editorArea.value

	if (found && found.node.name.endsWith('.spark')) {
		highlightArea.querySelector('code').innerHTML =
			highlightSpark(code, false) + '\n'
	} else if (found && found.node.name.endsWith('.spstyle')) {
		highlightArea.querySelector('code').innerHTML = highlightCss(code) + '\n'
	} else if (found && found.node.name.endsWith('.spjs')) {
		highlightArea.querySelector('code').innerHTML = highlightJs(code) + '\n'
	} else if (found && found.node.name.endsWith('.json')) {
		highlightArea.querySelector('code').innerHTML =
			highlightSpark(code, true) + '\n'
	} else {
		highlightArea.querySelector('code').innerHTML = escapeHtml(code) + '\n'
	}
}
