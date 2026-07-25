// ============================================================
//  ИИ-помощник (Puter.js — бесплатный доступ к LLM без API-ключей)
//  https://docs.puter.com/AI/chat/
// ============================================================

// Системный промпт: коротко объясняем модели, что такое Spark,
// чтобы советы и примеры кода были в правильном синтаксисе.
const AI_SYSTEM_PROMPT = `Ты — ассистент внутри браузерной Spark IDE. Помогай пользователю писать код на языке Spark, объясняй ошибки компиляции и пиши примеры.

Кратко про Spark (.spark файлы):
- Первая строка обычно "page ИмяСтраницы".
- Разметка на фигурных скобках, похоже на QML/SCSS: "selector { key: value ... вложенные_теги { ... } }". Пример:
  .card#main {
    bg: #1e1e2e
    p: 20px
    radius: 12px
    text: Привет
  }
- Селекторы: "tag.class1.class2#id", класс/id можно указывать без тега (тогда это div).
- КАЖДОЕ свойство/стиль/атрибут — на СВОЕЙ строке внутри { }, без запятых: "bg: #fff" (background), "c: black" (color), "p: 10px" (padding), "m: 10px" (margin), "radius: 8px" (border-radius), "w: 100%" (width), "h: 40px" (height), "font: 16px" (font-size), "align: center" (align-items), "justify: center" (justify-content), "direction: column" (flex-direction), "border", "shadow" (box-shadow), "gap", "cursor", "opacity", "z" (z-index). Есть шорткаты-строки без двоеточия: "flex" (display:flex) и "center" (flex + center по обеим осям). Остальные ключи — обычные HTML-атрибуты (placeholder, type, src и т.д.).
- Текст элемента — спец-свойство "text: значение" (кавычки не обязательны, если текст без спецсимволов вроде двоеточия; для текста со спецсимволами используй кавычки: text: "Привет: мир!").
- Вложенность — это просто вложенные блоки: родительский_тег { ...свойства... дочерний_тег { ...свойства... } }. Отступы нужны только для читаемости, на компиляцию не влияют — значение имеют исключительно { и }.
- Обработчики событий: "on click(#id) { ...тело... }" или "on load { ...тело... }". ВНУТРИ обработчика — это НАСТОЯЩИЙ JavaScript с настоящими { } (а не Spark-разметка): можно писать обычные if/else, for, while, function, try/catch и т.д. один в один как в JS, потому что скобки уже размечают границы блока сами. Пример:
  on click(#greetBtn) {
    let name = value(#nameInput)
    if (!name) {
      name = "Друг"
    }
    for (let i = 0; i < 3; i++) {
      print(i)
    }
    text(#output, "Привет, " + name)
  }
- Действия внутри обработчиков: select(#id), value(#id) / value(#id, "текст"), text(#id) / text(#id, "текст"), html(#id, "<b>..</b>"), css(#id, "prop", "val"), hide(#id), show(#id), toggle(#id), print(...). ВАЖНО: select(#id) возвращает СРАЗУ DOM-элемент (как document.querySelector), а НЕ обёртку с полем .el — никогда не пиши select(#id).el, используй результат select(...) напрямую, например: let box = select(#id); box.style.left = "10px".
- Переменные: "let name = value(#id)" — работает и внутри обработчиков событий, и на верхнем уровне страницы (вне on-блоков, без фигурных скобок вокруг let) как глобальная переменная, доступная во всех обработчиках.
- Импорт другого .spark файла: import "components/header.spark" (путь относительно корня проекта, без фигурных скобок).
- Файлы .spstyle — это ОБЫЧНЫЙ CSS (селекторы, свойства через двоеточие, фигурные скобки), а не Spark-синтаксис — они просто вставляются в <style> как есть.
- Файлы .spjs — это ОБЫЧНЫЙ JavaScript (не Spark-разметка, свой синтаксис не нужен). Он выполняется как есть и добавляется в итоговый script.js/тег <script> после всей скомпилированной Spark-логики. РЕКОМЕНДУЙ .spjs для любой сложной логики (игры, физика, циклы с вложенной работой с массивами/объектами, классы, таймеры, localStorage) — там доступны те же функции рантайма (select, value, text, html, css, hide, show, toggle, print), это обычный JS, который проще и надёжнее писать и отлаживать.
- Файл settings.json задаёт CSS-переменные темы редактора.

Отвечай на русском, кратко и по делу, код давай в блоках \`\`\`. Если пользователь прислал содержимое файла и текст ошибки — сначала объясни причину, затем предложи исправленный фрагмент.`

let aiHistory = [] // { role: 'user' | 'assistant', content: string }
let aiIsSending = false

function aiIsAvailable() {
	return typeof window.puter !== 'undefined' && window.puter && window.puter.ai
}

function aiCurrentFileContext() {
	const found =
		typeof activeTabId !== 'undefined' && activeTabId
			? findNode(activeTabId)
			: null
	if (!found || found.node.type !== 'file' || found.node.isBinary) return null
	return { name: found.node.name, content: found.node.content }
}

function aiExtractText(response) {
	if (!response) return ''
	if (typeof response === 'string') return response
	const msg = response.message || response
	if (typeof msg === 'string') return msg
	if (typeof msg.content === 'string') return msg.content
	if (Array.isArray(msg.content)) {
		return msg.content
			.map(c => (typeof c === 'string' ? c : c && c.text ? c.text : ''))
			.join('\n')
			.trim()
	}
	return ''
}

// Простой рендер markdown-подобного текста: код в ```блоках``` оформляем
// как <pre><code>, остальное — как экранированный текст с переносами строк.
function aiRenderMarkdown(text) {
	const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g)
	let html = ''
	for (let i = 0; i < parts.length; i++) {
		if (i % 3 === 0) {
			html += escapeHtml(parts[i]).replace(/\n/g, '<br>')
		} else if (i % 3 === 2) {
			html += `<pre class="ai-code"><code>${escapeHtml(parts[i].replace(/\n$/, ''))}</code></pre>`
		}
	}
	return html
}

function aiRenderMessages() {
	const container = document.getElementById('aiMessages')
	if (!container) return
	if (!aiHistory.length) {
		container.innerHTML = `
			<div class="ai-empty">
				<i class="ri-sparkling-2-line"></i>
				<p>Спросите про Spark-синтаксис, попросите написать компонент или объяснить ошибку компиляции.</p>
			</div>`
		return
	}
	container.innerHTML = ''
	for (const msg of aiHistory) {
		const row = document.createElement('div')
		row.className = 'ai-msg ai-msg-' + msg.role
		const bubble = document.createElement('div')
		bubble.className = 'ai-bubble'
		bubble.innerHTML = aiRenderMarkdown(msg.content)
		row.appendChild(bubble)
		container.appendChild(row)
	}
	if (aiIsSending) {
		const row = document.createElement('div')
		row.className = 'ai-msg ai-msg-assistant'
		row.innerHTML = `<div class="ai-bubble ai-typing"><span></span><span></span><span></span></div>`
		container.appendChild(row)
	}
	container.scrollTop = container.scrollHeight
}

function aiSetSending(state) {
	aiIsSending = state
	const sendBtn = document.getElementById('aiSendBtn')
	if (sendBtn) sendBtn.disabled = state
	aiRenderMessages()
}

async function aiSend(userText) {
	if (!userText.trim() || aiIsSending) return

	if (!aiIsAvailable()) {
		aiHistory.push({ role: 'user', content: userText })
		aiHistory.push({
			role: 'assistant',
			content:
				'Не удалось подключиться к Puter.js (js.puter.com). Проверьте подключение к интернету или настройки сети/блокировщика рекламы — без этого скрипта ИИ-помощник недоступен.',
		})
		aiRenderMessages()
		return
	}

	const includeContext = document.getElementById('aiIncludeContext')
	let messageForModel = userText
	if (includeContext && includeContext.checked) {
		const ctx = aiCurrentFileContext()
		if (ctx) {
			messageForModel = `Текущий открытый файл: ${ctx.name}\n\`\`\`\n${ctx.content}\n\`\`\`\n\nВопрос пользователя: ${userText}`
		}
	}

	aiHistory.push({ role: 'user', content: userText })
	aiRenderMessages()
	aiSetSending(true)

	const messages = [
		{ role: 'system', content: AI_SYSTEM_PROMPT },
		...aiHistory.slice(0, -1),
		{ role: 'user', content: messageForModel },
	]

	try {
		const response = await window.puter.ai.chat(messages)
		const text = aiExtractText(response) || 'Пустой ответ от модели.'
		aiHistory.push({ role: 'assistant', content: text })
	} catch (e) {
		aiHistory.push({
			role: 'assistant',
			content:
				'Ошибка запроса к ИИ: ' + (e && e.message ? e.message : String(e)),
		})
	}
	aiSetSending(false)
}

// Экспорт диалога с ИИ в .md — удобно, чтобы показать функционал
// ассистента кому-то ещё или сохранить историю переписки.
function aiExportChat() {
	if (!aiHistory.length) {
		showError('Диалог с ИИ пуст — нечего экспортировать.')
		return
	}
	const stamp = new Date().toLocaleString('ru-RU')
	let md = `# Диалог с ИИ-помощником Spark IDE\n\n_Экспортировано: ${stamp}_\n\n---\n\n`
	for (const msg of aiHistory) {
		md += msg.role === 'user' ? '### 🧑 Вы\n\n' : '### ✨ ИИ-помощник\n\n'
		md += msg.content.trim() + '\n\n---\n\n'
	}
	const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
	const filename = `spark-ai-chat-${Date.now()}.md`
	downloadBlob(blob, filename)
}

function openAiAssistant(prefill) {
	const modal = document.getElementById('aiAssistantModal')
	if (!modal) return
	modal.classList.add('open')
	aiRenderMessages()
	const input = document.getElementById('aiInput')
	if (prefill) input.value = prefill
	input.focus()
	aiAutoGrow(input)
}

function closeAiAssistant() {
	const modal = document.getElementById('aiAssistantModal')
	if (modal) modal.classList.remove('open')
	editorArea.focus()
}

// Быстрое действие из панели ошибок: сразу спрашиваем ИИ про текущую ошибку.
function aiExplainError(message) {
	openAiAssistant()
	const question = `Объясни, пожалуйста, эту ошибку компиляции Spark и предложи исправление: "${message}"`
	aiSend(question)
}

function aiAutoGrow(input) {
	input.style.height = 'auto'
	input.style.height = Math.min(140, input.scrollHeight) + 'px'
}

function initAiAssistant() {
	const btn = document.getElementById('aiAssistantBtn')
	if (!btn) return

	btn.addEventListener('click', () => openAiAssistant())
	document
		.getElementById('aiCloseBtn')
		.addEventListener('click', closeAiAssistant)
	document.getElementById('aiExportBtn').addEventListener('click', aiExportChat)
	document.getElementById('aiClearBtn').addEventListener('click', () => {
		aiHistory = []
		aiRenderMessages()
	})
	document.getElementById('aiAssistantModal').addEventListener('click', e => {
		if (e.target.id === 'aiAssistantModal') closeAiAssistant()
	})

	const input = document.getElementById('aiInput')
	const sendBtn = document.getElementById('aiSendBtn')

	function submit() {
		const text = input.value
		input.value = ''
		aiAutoGrow(input)
		aiSend(text)
	}

	sendBtn.addEventListener('click', submit)
	input.addEventListener('input', () => aiAutoGrow(input))
	input.addEventListener('keydown', e => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			submit()
		}
		if (e.key === 'Escape') {
			e.preventDefault()
			closeAiAssistant()
		}
	})
}
