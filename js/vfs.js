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

.container {
  bg: #0f172a
  c: #f8fafc
  p: 40px
  radius: 16px
  shadow: 0 20px 40px rgba(0,0,0,0.4)
  m: 40px auto
  w: 90%
  max-width: 480px

  h1 {
    text: Spark IDE — Быстрый Старт
    c: #38bdf8
    m: 0 0 10px 0
    font: 24px
  }
  p {
    text: Дизайн и логика в одном файле без лишнего кода!
    c: #94a3b8
    m: 0 0 24px 0
  }

  .card {
    bg: #1e293b
    p: 20px
    radius: 12px
    border: 1px solid #334155
    m: 0 0 20px 0

    input#nameInput {
      placeholder: "Ваше имя..."
      bg: #0f172a
      c: white
      p: 12px
      radius: 8px
      border: 1px solid #475569
      w: 100%
    }
  }

  .row {
    flex
    gap: 12px

    button#greetBtn {
      text: Поздороваться
      bg: #3b82f6
      c: white
      p: 12px 20px
      radius: 8px
      border: none
      cursor: pointer
      w: 100%
    }
    button#resetBtn {
      text: Сброс
      bg: #334155
      c: white
      p: 12px 20px
      radius: 8px
      border: none
      cursor: pointer
    }
  }

  .result#output {
    text: Результат появится здесь...
    bg: #0284c7
    c: white
    p: 14px
    radius: 8px
    m: 20px 0 0 0
  }
}

on click(#greetBtn) {
  let name = value(#nameInput)
  if (!name) {
    name = "Друг"
  }
  text(#output, "Привет, " + name + "! 👋 Welcome to Spark.")
  css(#output, "background", "#10b981")
  print("Приветствие отправлено для:", name)
}

on click(#resetBtn) {
  value(#nameInput, "")
  text(#output, "Результат появится здесь...")
  css(#output, "background", "#0284c7")
  print("Форма очищена.")
}

on load {
  print("Приложение успешно запущено!")
}
`
const DEFAULT_HEADER_COMPONENT = `// Шаблон компонента Header
.header-badge {
  text: ⚡ Компонент Header подключен
  bg: #1e1e2e
  c: #8b7bff
  p: 6px 12px
  radius: 20px
  font: 12px
  m: 0 0 15px 0
}
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
	if (name.endsWith('.spjs')) return 'ri-code-s-slash-line js-icon'
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

	const jsFiles = findAllByExt('.spjs')
	const jsCombined = jsFiles.map(f => `// ${f.name}\n` + f.content).join('\n\n')

	return { entryFile: entry ? entry.node : null, cssCombined, jsCombined }
}
