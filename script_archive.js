import { dom } from "./dom.js"
import { reactive, memo } from "./chowk.js"
import { drag } from "./drag.js"
import { extract_block_id, link_is_block, MD } from "./md.js"
import { try_auth, update_block, connect_block, add_block, get_channel } from "./arena.js"
import { svgline, svgrect, svgx } from "./svg.js"
import { addToRecents, focusSearchBar, sidebar, sidebarOpen } from "./sidebar.js"
import {
	authslug,
	store,
	state,
	save_data,
	canvasScale, canvasX, canvasY, mouse,
	dimensions,
	dataSubscriptions,
	selected
} from "./state.js"
import { keyVisualiser, sliderAxis, slidercursor } from "./components.js"

// this is for making blocks and groups
let canceled = false

// cancel node edge connectin
let cancelConnection = () => {
	document.querySelectorAll('.wobble').forEach(e => {
		e.classList.toggle('wobble')
	})
	state.block_connection_buffer = undefined
	save_data()
}

const round = (n, r) => Math.ceil(n / r) * r;

let lastHistory = []
let movingTimeout

const lerp = (start, stop, amt) => amt * (stop - start) + start
const InOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

let animateMove = (destX, destY) => {
	let last = {}
	last.x = canvasX.value()
	last.y = canvasY.value()

	let t = 0
	let v = 0
	let progress = () => {
		t += .03
		v = InOutQuad(t)
		canvasX.next(lerp(last.x, destX, v))
		canvasY.next(lerp(last.y, destY, v))
		if (t > .99) return
		movingTimeout = setTimeout(progress, 1000 / 60)
	}
	progress()

}

export function moveToBlock(id) {
	let found = document.querySelector("*[block-id='" + id + "']")
	if (found) {
		if (movingTimeout) clearTimeout(movingTimeout)
		let { x, y, width, height } = found.getBoundingClientRect()
		let xDist = x - 150
		let yDist = y - 150

		if (width < window.innerWidth) {
			let left = (window.innerWidth - width) / 2
			console.log(left)
			xDist = x - left
		}

		// if (height < window.innerHeight) {
		// 	let top = (window.innerHeight - height) / 2
		// 	yDist = y - top
		// }

		// if visible don't move
		// console.log(y, window.innerHeight, !())
		if (!(x > 0 && x + width < window.innerWidth)
			|| !(y > 0 && y + 150 < window.innerHeight)
		) {
			let last = {}
			last.x = canvasX.value()
			last.y = canvasY.value()

			lastHistory.push(last)

			let destX = (xDist / canvasScale.value()) + last.x
			let destY = (yDist / canvasScale.value()) + last.y

			animateMove(destX, destY)
		}


		let c = found.style.backgroundColor
		// let z = found.style.zindex
		found.style.backgroundColor = 'yellow'
		// found.style.zIndex = 99
		setTimeout(() => {
			found.style.backgroundColor = c
			// found.style.zIndex = z
		}, 800)
	}

	else {
		notificationpopup(
			['span', "Block not found, ",
				['a', {
					href: 'https://are.na/block/' + id,
					target: '_blank'
				},
					'jump to link'], "?"])
	}
}

export let updated = reactive(true)
export let notificationpopup = (msg, error = false) => {
	let d = dom('.notification' + (error ? '.error' : ''), {
		style: `
		position: fixed;
		right: -50vw;
		opactiy: 0;
		bottom: 1em;
		transition: 200ms;
	`}, error ? '🚫 ' : '', msg)

	document.querySelectorAll('.notification')
		.forEach((e) => {
			let b = parseFloat(e.style.bottom)
			e.style.bottom = (b + 5) + 'em'
		})

	document.body.appendChild(d)

	setTimeout(() => { d.style.right = '1em'; d.style.opacity = 1 }, 5)
	setTimeout(() => { d.style.opacity = 0 }, error ? 6000 : 4500)
	setTimeout(() => { d.remove() }, error ? 9500 : 8000)
}
const uuid = () => Math.random().toString(36).slice(-6);
const button = (t, fn, attr = {}) => ["button", { onclick: fn, ...attr }, t]
let nodesActive = reactive(true)

export let colors = [
	'var(--b1)',
	'var(--b2)',
	'var(--b3)',
	'var(--b4)',
	'var(--b5)',
	'var(--b6)',
];

export let tcolors = [
	'var(--c1)',
	'var(--c2)',
	'var(--c3)',
	'var(--c4)',
	'var(--c5)',
	'var(--c6)',
];

// [
// ]
// -------------------
// DATA
// -------------------
// USE keymanager instead
export let keys = []
let mountDone = false
let w = 300
''
export let currentslug = "are-na-canvas"
let local_currentslug = localStorage.getItem("slug")
if (local_currentslug) currentslug = local_currentslug

// -------------------
// Initialization FN
// -------------------
export let try_set_channel = slugOrURL => {
	// check if it is url
	let isUrl = slugOrURL.includes("are.na/");
	if (isUrl) {
		let slug = slugOrURL.split('/').filter(e => e != '').pop()
		set_channel(slug)
	}
	else {
		set_channel(slugOrURL.trim())
	}
}
export let set_channel = slug => {
	notificationpopup("Loading " + slug + "...")
	get_channel(slug)
		.then((res) => {
			if (!res.data) {
				console.log("Failed to get channel", res.error)
				notificationpopup(['span', 'Failed to get channel ' + slug, ' try opening ', ['a', { href: '#are-na-canvas' }, 'this']], true)
			}
			else {
				notificationpopup('Loaded Channel: ' + slug)
				notificationpopup('Total Blocks: ' + res.data.length)

				currentslug = slug
				addToRecents(slug)
				setSlug(slug)
				localStorage.setItem('slug', slug)
				renderBlocks(res.data)

			}
		})
}

let setSlug = (slug) => {
	history.pushState('', '', '#' + slug)
}

let constructBlockData = (e, i) => {
	let r1 = Math.random() * 850
	let r2 = Math.random() * 850

	let d = {
		id: e.id,
		width: 300,
		height: 300,
		color: '1'
	}
	if (typeof i == 'number') {

		d.x = (i % 8) * 400 + r1
		d.y = (Math.floor(i / 8)) * 450 + r2
	}
	else {
		d.x = i.x
		d.y = i.y
		d.width = i.width
		d.height = i.height
	}
	if (e.type == "Text") {
		d.type = 'text'
		d.text = e.content.markdown
	}

	else if (e.type == "Image") {
		d.type = 'link'
		d.url = e.image.large.src
	}

	else if (e.type == "Link") {
		d.type = 'link'
		d.url = e.source.url
	}

	else if (e.type == "Attachment") {
		d.type = 'link'
		d.url = e.attachment.url
	}

	else if (e.type == "Embed") {
		d.type = 'link'
		d.url = e.source.url
	}

	else {
		d.type = 'text'
		d.text = ''
	}

	return d
}
let groupData = (x, y, width, height) => {
	let d = {
		type: 'group',
		label: "Group",
		id: 'group-' + uuid(),
		x, y, width, height,
	}

	return d
}

let groupEl = group => {
	const isRectContained = (rect1, rect2) => {
		return (
			rect2.x >= rect1.x &&
			rect2.y >= rect1.y &&
			rect2.x + rect2.width <= rect1.x + rect1.width &&
			rect2.y + rect2.height <= rect1.y + rect1.height
		);
	}
	let anchored = []
	// make nodes accesible in a hashmap so dont' have to do this find bs everytime
	let position = store.data.nodes.find(e => e.id == group.id)
	if (!position) console.error("BRUH HOW")
	position = store.data.nodes.find(e => e.id == group.id)
	if (!position.color) position.color = '5'
	if (!position.label) position.label = 'Group'

	let updateFn = (data) => {
		let p = (data.nodes.find(e => e.id == group.id))
		if (!p) {
			let i = dataSubscriptions.findIndex(e => e == updateFn)
			if (i != -1) dataSubscriptions.splice(i, 1)
		}

		if (!p) return

		if (p.x != left.value()) left.next(p.x)
		if (p.y != top.value()) top.next(p.y)
		if (p.width != width.value()) width.next(p.width)
		if (p.height != height.value()) height.next(p.height)
	}

	dataSubscriptions.push(updateFn)

	// repetitive...
	let left = reactive(position.x)
	let top = reactive(position.y)
	let width = reactive(position.width)
	let height = reactive(position.height)
	let color = reactive(position.color)

	color.subscribe(v => position.color = v)
	left.subscribe(v => position.x = v)
	top.subscribe(v => position.y = v)
	width.subscribe(v => position.width = v)
	height.subscribe(v => position.height = v)

	memo(() => {
		position.color = color.value()
		position.x = left.value()
		position.y = top.value()
		position.width = width.value()
		position.height = height.value()
		save_data()
	}, [left, top, width, height, color])

	let setcolorfn = i => () => color.next(i + "")
	let removeButton = () => {
		let click = reactive(0)
		let words = ['delete', 'DELETE', "DELETE!", "DELEETEEEE!!!!"]
		let onclick = () => {
			click.next(e => e + 1)
			if (click.value() == words.length) remove()
		}
		return button(memo(() => words[click.value()], [click]), onclick)
	}
	let colorbuttons =
		['.color-bar', ...[1, 2, 3, 4, 5, 6]
			.map((i) => button('x', setcolorfn(i), { style: `background-color: ${colors[i - 1]}; color: ${tcolors[i - 1]};` })), removeButton()]

	let remove = () => {
		let i = store.data.nodes.findIndex(e => e == position)
		store.data.nodes.splice(i, 1)
		save_data()
		draggable.remove()
	}

	// repetitive
	let style = memo(() => `
		position: absolute;
		left: ${left.value()}px;
		top: ${top.value()}px;
		background-color: var(--g${color.value()});
		border-color: var(--bor${color.value()});
		border-width: 4px;
		color: ${tcolors[parseInt(color.value()) - 1]};
		width: ${width.value()}px;
		height: ${height.value()}px
	`, [left, top, width, height, color])

	let resize = memo(() => `
		left:${width.value() - 15}px;
		top:${height.value() - 15}px;
`, [width, height])

	let resizewidthmiddle = memo(() => `
		left:${width.value() - 15}px;
		top:${height.value() / 4}px;
		height: ${height.value() / 2}px;
`, [width, height])

	let resizeheightmiddle = memo(() => `
		top:${height.value() - 15}px;
		left:${width.value() / 4}px;
		width: ${width.value() / 2}px;
`, [height, width])



	let resizer = dom(".absolute.flex-center.box.cur-se", { style: resize }, svgx(30))
	let resizerwidthmiddle = dom(".absolute.flex-center.box.cur-e", { style: resizewidthmiddle }, svgx(30))
	let resizerheightmiddle = dom(".absolute.flex-center.box.cur-s", { style: resizeheightmiddle }, svgx(30))

	let draggable = dom('.draggable.group', { style: style }, colorbuttons, resizer, resizerheightmiddle, resizerwidthmiddle)
	let el

	let editingLabel = reactive(false)
	let textLabel = () => ['h4', { onclick: () => { editingLabel.next(true) } }, position.label]
	let editLabel = () => ['div', ['input',
		{
			onclick: (e) => { e.stopImmediatePropagation(); e.stopPropagation(); console.log("TYUF") },
			oninput: (e) => { position.label = e.target.value },
			onkeydown: (e) => { if (e.key == 'Enter') editingLabel.next(false) },
			value: position.label
		}],

		button("set", () => editingLabel.next(false))]

	let title = dom(['.label', memo(() => editingLabel.value() ? editLabel() : textLabel(), [editingLabel])])

	el = [".block.group", title]
	el = dom(el)
	draggable.appendChild(el)

	let onstart = (e) => {
		if (e.metaKey) return
		store.data.nodes.forEach((e) => {
			if (
				// e.type != 'group' &&
				isRectContained(
					{ x: left.value(), y: top.value(), width: width.value(), height: height.value() },
					{ x: e.x, y: e.y, width: e.width, height: e.height },
				)) {
				// TODO: see if you can make it so the elems become children of the group instead of updating each of them individually...
				let item = {
					block: e,
					offset: {
						x: e.x - left.value(),
						y: e.y - top.value(),
					}
				}
				anchored.push(item)
			}
		})
	}
	let onend = () => {
		anchored = []
	}

	setTimeout(() => {
		let set_left = (v) => {
			left.next(v)
			anchored.forEach(e => {
				e.block.x = v + e.offset.x
				save_data()
			})
		}
		let set_top = (v) => {
			top.next(v)
			anchored.forEach(e => {
				e.block.y = v + e.offset.y
				save_data()
			})
		}

		drag(draggable, { set_left, set_top, onstart, onend, bound: 'inner' })
		drag(resizer, { set_left: (v) => width.next(v), set_top: (v) => height.next(v) })
		drag(resizerwidthmiddle, { set_left: (v) => width.next(v), set_top: () => null })
		drag(resizerheightmiddle, { set_left: () => null, set_top: (v) => height.next(v) })
	}, 100)
	return draggable

}
let blockEl = block => {
	// Convert From  v3 to v2 
	if (block.class) {
		block.type = block.class
		if (block.type == 'Text') {
			block.content = {
				markdown: block.content,
			}
		}
	}
	let position = store.data.nodes.find(e => e.id == block.id)
	if (!position) store.data.nodes.push(constructBlockData(block, 0))
	position = store.data.nodes.find(e => e.id == block.id)
	if (!position.color) position.color = '1'

	let updateFn = (data) => {
		let p = (data.nodes.find(e => e.id == block.id))
		if (!p) {
			// should probably delete self
			let i = dataSubscriptions.findIndex(e => e == updateFn)
			if (i != -1) dataSubscriptions.splice(i, 1)
		}
		if (!p) return

		if (p.x != left.value()) left.next(p.x)
		if (p.y != top.value()) top.next(p.y)
		if (p.width != width.value()) width.next(p.width)
		if (p.height != height.value()) height.next(p.height)
	}
	dataSubscriptions.push(updateFn)

	let isSelected = memo(() => selected.value().includes(block.id), [selected])
	let isMultiselected = memo(() => isSelected.value() && selected.value().length > 1,[selected])

	let left = reactive(position.x)
	let top = reactive(position.y)
	let width = reactive(position.width)
	let height = reactive(position.height)
	let color = reactive(position.color)

	// color.subscribe(v => position.color = v)
	// left.subscribe(v => position.x = v)
	// top.subscribe(v => position.y = v)
	// width.subscribe(v => position.width = v)
	// height.subscribe(v => position.height = v)

	memo(() => {
		position.color = color.value()
		position.x = left.value()
		position.y = top.value()
		position.width = width.value()
		position.height = height.value()
		save_data()
	}, [left, top, width, height, color])


	let style = memo(() => `
		position: absolute;
		background-color: ${colors[parseInt(color.value()) - 1]};
		color: ${tcolors[parseInt(color.value()) - 1]};
		left: ${left.value()}px;
		top: ${top.value()}px;
		width: ${width.value()}px;
		height: ${height.value()}px
	`, [left, top, width, height, color])

	let resize = memo(() => `
		left:${width.value() - 15}px;
		top:${height.value() - 15}px;
`, [width, height])

	let resizewidthmiddle = memo(() => `
		left:${width.value() - 15}px;
		top:${height.value() / 4}px;
		height: ${height.value() / 2}px;
`, [width, height])

	let resizeheightmiddle = memo(() => `
		top:${height.value() - 15}px;
		left:${width.value() / 4}px;
		width: ${width.value() / 2}px;
`, [height, width])

	let connectionPointBottom = memo(() => `
		top:${height.value() - 15}px;
		left:${width.value() / 2}px;
`, [height, width])

	let connectionPointRight = memo(() => `
		top:${height.value() / 2}px;
		left:${width.value() - 15}px;
`, [height, width])

	let connectionPointTop = memo(() => `
		top:-15px;
		left:${width.value() / 2}px;
`, [height, width])

	let connectionPointLeft = memo(() => `
		top:${height.value() / 2}px;
		left:-15px;
`, [height, width])


	let connectionPoint = (side, style) => dom('.edge-connector.absolute.flex-center.box', {
		style, onclick: e => {
			if (state.block_connection_buffer) {
				store.data.edges.push({
					id: uuid(),
					...state.block_connection_buffer,
					toNode: block.id,
					toSide: side
				})

				document.querySelectorAll('.wobble').forEach(e => {
					e.classList.toggle('wobble')
				})

				state.block_connection_buffer = undefined
				save_data()
			}
			else {
				e.target.classList.toggle('wobble')
				state.block_connection_buffer = { fromNode: block.id, fromSide: side }
			}
		}
	}, 'X')

	let connectionPoints = [
		connectionPoint('top', connectionPointTop),
		connectionPoint('left', connectionPointLeft),
		connectionPoint('bottom', connectionPointBottom),
		connectionPoint('right', connectionPointRight),
	]



	let resizer = dom(".absolute.flex-center.box.cur-se",
		{ style: resize },
		svgx(30))
	let resizerwidthmiddle = dom(".absolute.flex-center.box.cur-e", { style: resizewidthmiddle }, svgx(30))
	let resizerheightmiddle = dom(".absolute.flex-center.box.cur-s", { style: resizeheightmiddle }, svgx(30))

	let setcolorfn = i => () => color.next(i + "")
	let colorbuttons = ['.color-bar', ...[1, 2, 3, 4, 5, 6].map((i) => button('x', setcolorfn(i), { style: 'background-color: ' + colors[i - 1] + ";" }))]
	let blockUserTag = ["p.tag", block.user?.slug]
	let blockTitleTag = ["p.tag", block.title]
	let editBlock = () => {
		edit = true
		mountResizers()
		draggable.appendChild(textarea(value))
	}
	let editButton = button('edit', editBlock)
	let owned = memo(() => block.user?.slug == authslug.value(), [authslug])
	let editOrTag = memo(() =>
		owned.value() && block.type == 'Text'
			? editButton
			// : block.title ?
			// 	blockTitleTag
			: blockUserTag, [owned])

	let copyLink = button("copy", (e) => {
		let link = "https://are.na/block/" + block.id
		if (e.metaKey) link = `[title](${link})`
		navigator.clipboard.writeText(link)
	})

	let jumpToArena = button("", (e) => {
		let link = "https://are.na/block/" + block.id
		window.open(link, '_blank').focus();
	})

	let topBar = [['.top-bar'], editOrTag, colorbuttons]
	let bottomBar = dom(['.bottom-bar', copyLink, jumpToArena])
	let draggable = dom('.draggable.node', {
		selected: isSelected,
		'multi-selected': isMultiselected,
		'block-id': block.id,
		style: style,
		ondblclick: () => { block.type == 'Text' && !edit ? editBlock() : null }
	}, topBar, bottomBar, ...connectionPoints, resizer, resizerheightmiddle, resizerwidthmiddle)
	let el
	let image = block => {
		let link = block.image?.large?.src || block.image?.large?.url
		return ['img', { src: link }]
	}
	let edit = false
	let setValue = (t) => {
		wc.next(t.split(' ').length)
		console.log(wc.value())
		value = t
	}
	let textarea = md => {
		// on creation keep old value to reset
		old = value
		return dom([".block.text", ["textarea", {
			onclick: (e) => {
				e.stopPropagation();
				e.stopImmediatePropagation()
			},
			oninput: e => setValue(e.target.value),
			onkeydown: e => {
				if (e.key == 's' && (e.metaKey || e.ctrlKey)) {
					saveBlock()
				}
			}
		}, md], ['p', "wc: ", wc]])
	}

	let value = block.content?.markdown
	let wc = reactive(value?.split(" ").length)

	let old = ''
	let saveBlock = () => {
		edit = false
		update_block(block.id, { content: value })
			.then(res => {
				if (res.status == 204) notificationpopup("Updated 👍")
				else if (res.status == 401) notificationpopup("Failed: Unauthorized :( ", true)
				else notificationpopup("Failed :( status: " + res.status, true)
			})
		mountResizers()
		draggable.appendChild(dom([".block.text", ...MD(value)]))

	}
	let cancelEdit = () => {
		setValue(old)
		edit = false
		mountResizers()
		draggable.appendChild(dom([".block.text", ...MD(value)]))
	}

	let saveButton = dom(button("save", saveBlock))
	let cancelButton = dom(button('cancel', cancelEdit))
	let mountResizers = () => {
		draggable.innerHTML = ``;
		draggable.appendChild(resizer)
		draggable.appendChild(resizerwidthmiddle)
		draggable.appendChild(resizerheightmiddle)

		connectionPoints.forEach(e => draggable.appendChild(e))

		topBar = ['.top-bar']

		if (edit) {
			if (owned.value()) topBar.push(saveButton)
			topBar.push(cancelButton)
			topBar.push(colorbuttons)
		} else {
			topBar.push(editOrTag)
			topBar.push(colorbuttons)
		}

		let el = dom(topBar)

		draggable.appendChild(el)
		draggable.appendChild(bottomBar)
	}

	if (block.type == "Text") {
		el = [".block.text", ...MD(value)]
	}

	else if (block.type == "Channel") {
		console.log("CHANNEL", block)
		el = [".block.channel",
			['h2', block.title],
			['h4', ['strong', block.slug]],
			['p', ['a', { href: "#" + block.slug }, button('Open in Canvas')]],
			['p', ['a', { href: "https://are.na/channel/" + block.slug }, button('View on Are.na')]]
		]
	}

	else if (block.type == "Image") el = [".block.image", image(block)]
	else if (block.type == "Attachment") el = [".block.image", image(block)]
	else if (block.type == "Link") el = [".block.image", image(block)]
	else if (block.type == "Embed") el = [".block.image", image(block)]
	else el = [".block", block.id + ""]
	el = dom(el)
	draggable.appendChild(el)

	let onstart = (e) => {
		console.log('started')
		e.shiftKey ?

			selected.next(e => [...e, block.id]) :
			selected.next([block.id])
	}

	setTimeout(() => {
		let set_position = (x, y) => {
			left.next(round(x, 5))
			top.next(round(y, 5))
		}

		drag(draggable, { set_position, pan_switch: () => !edit, bound: 'inner', onstart },)
		drag(resizer,
			{
				set_left: (v) => width.next(v),
				set_top: (v) => height.next(v)
			})
		drag(resizerwidthmiddle, { set_left: (v) => width.next(v), set_top: () => null })
		drag(resizerheightmiddle, { set_left: () => null, set_top: (v) => height.next(v) })
	}, 100)
	return draggable
}

let processBlockForRendering = (blocks) => {
	blocks = blocks.filter(e => e.title != ".canvas")
	return blocks
}

let updateData = (blocks) => {
	state.dotcanvas = (blocks.find(e => e.title == '.canvas'))
	if (state.dotcanvas) {
		// put in a try block
		store.data = JSON.parse(state.dotcanvas.content.plain)
		store.data.nodes.forEach(node => {
			if (node.type == 'text') {
				// find the block
				let f = blocks.find(e => e.id == node.id)
				if (f && f.type == 'Text') node.text = f.content.markdown
			}
		})

		// if data has blocks that aren't in blocks... remove them
		store.data.nodes.forEach(node => {
			if (node.type == 'group') return
			let f = blocks.find(e => e.id == node.id)
			if (!f) {
				console.log('removing', node)
				let i = store.data.nodes.findIndex(n => n == node)
				store.data.nodes.splice(i, 1)
			}
		})

	}

	if (!store.data) {
		let nodes = blocks.filter(e => e.title != ".canvas").map(constructBlockData)
		store.data = { nodes, edges: [] }
	}

}

function intersectRect(r1, r2) {
	return !(r2.left > r1.right ||
		r2.right < r1.left ||
		r2.top > r1.bottom ||
		r2.bottom < r1.top);
}

let pointStart = reactive([0, 0])
let pointEnd = reactive([0, 0])

let renderBlocks = (blocks) => {
	// channel uses a c prepended id
	blocks = blocks.map(e => {
		if (e.type == 'Channel') {
			console.log("Channel?", e)
			e.id = 'c' + e.id
		}

		return e
	})

	// reset stuff
	// I think itll be a good idea to just do a page refresh
	// connections = []
	store.data = undefined
	let c = document.querySelector(".container")
	c ? c.remove() : null

	// try find a .canvas block
	updateData(blocks)
	blocks = processBlockForRendering(blocks)

	if (!mountDone) mount()

	let timer = reactive(0)
	setInterval(() => timer.next(e => e + 1), 500)

	// ALternate Zoom
	let funkystylememo = memo(() => `
	transform-origin:
		${canvasX.value() + (mouse.value().x / canvasScale.value()) / 2}px
		${canvasY.value() + (mouse.value().y / canvasScale.value()) / 2}px;

		transform: translate(${canvasX.value() * -1}px, ${canvasY.value() * -1}px) scale(${canvasScale.value()}) ;`,
		[canvasX, canvasY, canvasScale, mouse])
	let stylemmeo = memo(() => `
		transform-origin:
			${canvasX.value() + window.innerWidth / 2}px
			${canvasY.value() + window.innerHeight / 2}px;

		transform: translate(${canvasX.value() * -1}px, ${canvasY.value() * -1}px) scale(${canvasScale.value()}) ;
`, [canvasX, canvasY, canvasScale])


	try_auth()
	let blocksmapped = blocks.filter(e => e.type != 'group').map(blockEl)
	let groupRender = reactive(0)
	let groupmapped = memo(() => store.data.nodes.filter(e => e.type == 'group').map(groupEl), [groupRender])

	let anchor = undefined

	let makingBlock = false
	let makingGroup = false
	let holding = reactive(false)
	let onpointerdown = e => {
		let target = e.target
		if (e.target != document.querySelector('.container')) return
		selected.next([])
		console.log("Will start drag at: ", e.offsetX, e.offsetY,
			"For element: ", e.target,
			"ID: ", e.pointerId,
		)

		canceled = false
		pointStart.next([e.offsetX, e.offsetY])
		pointEnd.next([e.offsetX, e.offsetY])

		target.setPointerCapture(e.pointerId);

		if (e.metaKey) { makingBlock = true }
		else if (e.shiftKey) { makingGroup = true }
		else {
			anchor = {
				x: canvasX.value(),
				y: canvasY.value(),
				scale: canvasScale.value(),
			}
			holding.next(true)
		}
	}
	let onpointermove = e => {
		let target = e.target

		if (!target.hasPointerCapture(e.pointerId)) return;

		const deltaX = e.movementX / canvasScale.value();
		const deltaY = e.movementY / canvasScale.value();
		pointEnd.next(v => [v[0] + deltaX, v[1] + deltaY])
		if (anchor) {
			canvasX.next(anchor.x + (pointStart.value()[0] - pointEnd.value()[0]))
			canvasY.next(anchor.y + (pointStart.value()[1] - pointEnd.value()[1]))
		}
	}
	let onpointerup = e => {
		let target = e.target
		holding.next(false)
		let pointsToAt = (x1, y1, x2, y2) => ({
			x: Math.min(x1, x2), y: Math.min(y1, y2),
			width: Math.abs(x2 - x1),
			height: Math.abs(y2 - y1),
		})
		let { x, y, width, height } = pointsToAt(...pointStart.value(), ...pointEnd.value())
		target.releasePointerCapture(e.pointerId);

		pointStart.next([0, 0])
		pointEnd.next([0, 0])


		if (anchor) {
			anchor = undefined
			return
		}

		if (canceled) {
			canceled = false
			return
		}
		if (makingBlock) {
			makingBlock = false
			if (width < 150 || height < 150) return
			add_block(currentslug, '', "# New Block")
				.then((res) => {

					console.log(res)
					let newBlock = constructBlockData(res, { x, y, width, height })
					store.data.nodes.push(newBlock)
					document.querySelector('.container').appendChild(blockEl(res))

					save_data()
				})

		}
		else if (makingGroup) {
			if (width < 250 || height < 250) return
			let d = groupData(x, y, width, height)
			store.data.nodes.push(d)
			groupRender.next(e => e + 1)
		}

	}

	// let lines = memo(() => {
	// 	if (state.blockConnectionBuffer)
	// 		return [
	// 			state.blockConnectionBuffer.fromPoint.x,
	// 			state.blockConnectionBuffer.fromPoint.y,
	// 			mouse.value().x, 
	// 			mouse.value().y
	// 		]
	// 	else return [0,0,0,0]
	// }, [mouse])

	let bigline = memo(() => [
		// svgline(...lines.value()),
		svgrect(...pointStart.value(), ...pointEnd.value(), "black", (anchor || canceled) ? 0 : 3)
	], [pointStart, pointEnd])

	let anchored = []
	let boundingAnchor = {}
	let dimsMemo = memo(() => {
		anchored = []
		let sel = store.data.nodes
			.filter(e => selected.value().includes(e.id))

		sel.forEach(e => {
			let item = {
				block: e,
				offset: { x: e.x, y: e.y }
			}
			anchored.push(item)
		})

		let dims = sel.reduce((acc, e, i) => {
			if (i == 0) {
				Object.assign(acc, {
					x: e.x,
					y: e.y,
					x2: e.x + e.width,
					y2: e.y + e.height,
				})
			}

			else {
				acc.x = Math.min(acc.x, e.x)
				acc.y = Math.min(acc.y, e.y)
				acc.x2 = Math.max(acc.x2, e.x + e.width)
				acc.y2 = Math.max(acc.y2, e.y + e.height)
			}

			return acc
		}, {})
		return { dims, sel }

	}, [selected])
	let dawgWalkers = memo(() => {
		let { dims, sel } = dimsMemo.value()
		boundingAnchor = {
			x: dims.x,
			y: dims.y,
			width: dims.x2 - dims.x,
			height: dims.y2 - dims.y,
		}
		if (sel.length > 1) {
			return `
left: ${dims.x}px;
top: ${dims.y}px;
width: ${dims.x2 - dims.x}px;
height: ${dims.y2 - dims.y}px;
border: 4px solid var(--bor6);
`
		}

		else return ''
	}, [dimsMemo])

	let bigbox = dom('.absolute.big-box', { style: dawgWalkers },
		memo(() => {
			let { dims, sel } = dimsMemo.value();
			return svgx(dims.x2-dims.x, dims.y2-dims.y, '#E3CFF5')
		}, [dimsMemo]))

	setTimeout(() => {
		let set_position = (x, y) => {
			let diff = {
				x: x - boundingAnchor.x,
				y: y - boundingAnchor.y
			}

			anchored.forEach(e => {
				e.block.x = e.offset.x + diff.x
				save_data()

				e.block.y = e.offset.y + diff.y
				save_data()
			})

			bigbox.style.left = x + 'px'
			bigbox.style.top = y + 'px'
		}

		drag(bigbox, { set_position })
	}, 150)

	let edgesRender = reactive(0)
	let edges = memo(() => {
		if (!store.data.edges) return []
		return store.data.edges.map(e => {
			let boundingToSide = (b, side) => {
				if (side == 'top') {
					return ({
						x: b.x + b.width / 2,
						y: b.y
					})
				}

				if (side == 'bottom') {
					return ({
						x: b.x + b.width / 2,
						y: b.y + b.height
					})
				}

				if (side == 'right') {
					return ({
						x: b.x + b.width,
						y: b.y + b.height / 2
					})
				}

				if (side == 'left') {
					return ({
						x: b.x,
						y: b.y + b.height / 2
					})
				}
			}

			let from = store.data.nodes.find(b => b.id == e.fromNode)
			let to = store.data.nodes.find(b => b.id == e.toNode)

			let fromT = boundingToSide(from, e.fromSide)
			let toT = boundingToSide(to, e.toSide)

			return svgline(fromT.x, fromT.y, toT.x, toT.y, 'black', 7, 0, {
				onmouseenter: () => {
					console.log(e)
					state.selectedConnection = e
				},
				onmouseexit: () => { state.selectedConnection = undefined },
			})
		})
	}, [edgesRender])

	dataSubscriptions.push(f => edgesRender.next(e => e + 1))

	let stupidSVG = ['svg', { width: dimensions, height: dimensions }, bigline, edges, dawgWalkers]

	let root = [".container",
		{
			holding,
			style: stylemmeo,
			onpointerdown, onpointermove, onpointerup
		}, stupidSVG, groupmapped, ...blocksmapped, bigbox]

	document.body.appendChild(dom(root))
}

let helpactive = reactive(false)
let mount = () => {
	mountDone = true;
	// Nodes
	let slcurse = slidercursor({
		left: 40,
		top: window.innerHeight - (w + 45),
		min: 1,
		max: dimensions,
		height: w,
		width: w,
		value: 1,
	})
	let sls = sliderAxis({
		left: window.innerWidth - 70,
		top: window.innerHeight / 2 - w,
		min: .1,
		max: 2.5,
		height: w,
		width: 15,
		value: canvasScale.value(),
		axis: 'vertical',
		input: canvasScale,
		output: canvasScale,
		label: "+",
	})
	let k = keyVisualiser({
		left: window.innerWidth - 100,
		top: 60,
	})
	let slx = sliderAxis({
		min: 0,
		left: 40,
		top: window.innerHeight - (w + 125),
		width: w,
		height: 15,
		axis: 'horizontal',
		max: dimensions,
		value: 1,
		input: canvasX,
		output: canvasX,
		label: "X",
	})
	let sly = sliderAxis({
		min: 0,
		height: w,
		left: w + 105,
		top: window.innerHeight - (w + 45),
		width: 15,
		axis: 'vertical',
		max: dimensions,
		value: 1,
		input: canvasY,
		output: canvasY,
		label: "Y",
	})

	// SVG STUFF
	// Fix the leaks here...
	// TODO: Big leaks isssueee with svg lines.... :(
	let lines = memo(() => {
		let l = []
		if (state.nodeConnectionBuffer)
			l.push([
				state.nodeConnectionBuffer.line()[0],
				state.nodeConnectionBuffer.line()[1],
				mouse.value().x,
				mouse.value().y])
		state.connections.forEach(e => l.push(e.line()))
		return l
	}, [mouse])
	let lineEls = memo(() => lines.value().map(f => svgline(...f, '#00f8', 2, 4)), [lines])
	// Fix the leaks here...
	let svg = ['svg.line-canvas', { width: window.innerWidth, height: window.innerHeight }, lineEls]

	let nodes = [svg, slcurse, sls, sly, slx, k]
	let pos = (x, y) => `position: fixed; left: ${x}em; top: ${y}em; z-index: 9999;`
	let posbr = (x, y) => `position: fixed; right: ${x}em; bottom: ${y}em; z-index: 9999;`

	let openbtn = button(['span', 'SIDEBAR ', ['code', "⌘E"]], () => { sidebarOpen.next(e => e == true ? false : true) }, { style: pos(1, 1) })
	let savebtn = button(['span', 'SAVE ', ['code', "⌘S"]], saveCanvasToArena, { style: pos(9, 1), updated })

	let helpbtn = button(['span', 'HELP ', ['code', "?"]], () => helpactive.next(e => !e), { style: posbr(1, 1) })
	let commandSections = {
		drag: `

| CMD        | Action                  |  
| ---------- | ---------------------- |  
| __Drag__     | (on canvas) To Pan   |
| __Drag__     | (on blocks) To move them   |
| __⌘+Drag__  |  To make a new Block   |
| __⇧+Drag__  |  To make a new Group   |
| __⌘+Drag__  |  (on a group) To Move without children   |
| __⌘+Scroll__  |  To zoom in and out   |

`,

		navigation: `
| CMD             | Action                 |  
| --------------- | ---------------------- |  
| __⌘ + =__ | Zoom in |
| __⌘ + -__ | Zoom out|
| __B__ | Jump to location before previous jump when using block links |
| __T__ | Toggle between trackpad mode and scroll mode  |
| __WASD__      | Move around the canvas |  
| __ArrowKeys__ | Move around the canvas |
`,

		misc: `
| CMD        | Action                 |  
| ---------- | ---------------------- |  
| __⌘+E__ | Open sidebar |
| __⇧+H__ | Hide Nodes |
| __⌘S__        |  Save                   |
| __⌘D__        |  Download .canvas to open in Obsidian or kinopio                   |
`


	}
	let current = reactive(commandSections.drag)
	let helpbar = ['.help', {
		style: `background: var(--b${Math.floor(Math.random() * 6)});`,
		active: helpactive
	},
		memo(() => MD(current.value()), [current]),
		button('Drag', () => current.next(commandSections.drag)),
		button('Navigation', () => current.next(commandSections.navigation)),
		button('Misc', () => current.next(commandSections.misc)),
	]

	document.body.appendChild(dom(['.nodes', { active: nodesActive }, ...nodes]))

	document.body.appendChild(dom(sidebar))
	document.body.appendChild(dom(openbtn))
	document.body.appendChild(dom(savebtn))
	document.body.appendChild(dom(helpbtn))
	document.body.appendChild(dom(helpbar))
}

document.onkeydown = (e) => {
	keys.forEach((key) => key.fn(e))
	let inc = e => e.shiftKey ? 250 : 50
	let inEdit = (e) => {
		if (e.target instanceof HTMLInputElement) return true
		else if (e.target instanceof HTMLTextAreaElement) return true
		return false
	}

	if (e.key == '?') {
		if (inEdit(e)) return
		helpactive.next(e => !e)
	}

	if (e.key == 'Delete' || e.key == 'Backspace') {
		console.log("OK?", state.selectedConnection)
		if (state.selectedConnection) {
			let i = store.data.edges.findIndex(f => f == state.selectedConnection)
			if (i != -1) {
				store.data.edges.splice(i, 1)
				save_data()
			}
		}

	}
	if (e.key == 'Escape') {
		if (e.target.blur) e.target.blur()
		e.preventDefault()
		canceled = true
		selected.next([])
		cancelConnection()
	}

	if (e.key == 'H') {
		if (inEdit(e)) return
		nodesActive.next(e => !e)
	}

	if (e.key == 'b') {
		if (inEdit(e)) return
		let last = lastHistory.pop()
		if (!last) return

		animateMove(last.x, last.y)
	}

	if (e.key.toLowerCase() == 't') {
		if (inEdit(e)) return
		trackpadMovement = !trackpadMovement
	}

	if (e.key == '=' && e.metaKey) {
		e.preventDefault()
		canvasScale.next(e => e + (inc(e) / 500))
	}

	if (e.key == '-' && e.metaKey) {
		e.preventDefault()
		canvasScale.next(e => e - (inc(e) / 500))
	}


	if (e.key == 'ArrowUp' || e.key.toLowerCase() == 'w') {
		if (inEdit(e)) return
		e.preventDefault()
		canvasY.next(v => v - inc(e))
	}


	if (e.key == 'ArrowDown' || e.key.toLowerCase() == 's') {
		if (inEdit(e)) return
		e.preventDefault()
		canvasY.next(v => v + inc(e))
	}

	if (e.key == 'ArrowRight' || e.key.toLowerCase() == 'd') {
		if (inEdit(e)) return
		e.preventDefault()
		canvasX.next(v => v + inc(e))
	}

	if (e.key == 'ArrowLeft' || e.key.toLowerCase() == 'a') {
		if (inEdit(e)) return
		e.preventDefault()
		canvasX.next(v => v - inc(e))
	}

	if (e.key == 's' && e.metaKey) {
		if (inEdit(e)) return
		e.preventDefault()
		saveCanvasToArena()
	}

	if (e.key == 'e' && e.metaKey) {
		if (inEdit(e)) return
		e.preventDefault()
		sidebarOpen.next(e => !e)
	}

	if (e.key == 'v' && e.metaKey) {
		if (inEdit(e)) return
		e.preventDefault()
		console.log("V")
		navigator.clipboard.readText().then(res =>res.split('\n').forEach(res =>  {
			if (link_is_block(res)) {
				console.log('will connect block: ', extract_block_id(res), ' to slug')
				connect_block(currentslug, extract_block_id(res))
					.then(block => {
						console.log("BLock?", block)
						let newBlock = constructBlockData(block, { x: canvasX.value(), y: canvasY.value(), width: 350, height: 350 })
						store.data.nodes.push(newBlock)
						document.querySelector('.container').appendChild(blockEl(block))

						save_data()
					})
			}
		}))
	}
	if (e.key == 'c' && e.metaKey) {
		if (inEdit(e)) return
		e.preventDefault()
		navigator.clipboard.writeText(
			selected.value().map(e => 'https://are.na/block/'+e).join("\n")
		)
	}

	if (e.key == '/' && sidebarOpen.value()) {
		if (inEdit(e)) return
		focusSearchBar()
	}

	if (e.key == 'd' && e.metaKey) {
		if (inEdit(e)) return
		e.preventDefault()
		let download_json = (json, file = 'data') => {
			let a = document.createElement("a");

			json = JSON.stringify(json)
			console.log(json)
			let blob = new Blob([json], { type: "octet/stream" })
			let url = window.URL.createObjectURL(blob);

			a.href = url;
			a.download = file + ".canvas";
			a.click();
			window.URL.revokeObjectURL(url);
		};

		download_json(store.data, currentslug)
	}
}
document.onmousemove = (e) => {
	mouse.next({ x: parseFloat(e.clientX), y: parseFloat(e.clientY) })
}

document.ondragover = (e) => { e.preventDefault(); }
document.ondrop = e => {
	e.preventDefault();
	const fileItems = [...e.dataTransfer.files]
	fileItems.forEach((file) => {
		let reader = new FileReader();
		reader.onload = function (event) {
			processNewCanvas(event.target.result)
		};
		reader.readAsText(file);
	})
}

let processNewCanvas = str => {
	let d
	try {
		d = JSON.parse(str)
	} catch (e) {
		console.log('failes', e)
	}

	let updateList = []
	if (d) {
		d.nodes.forEach(b => {
			let f = store.data.nodes.find(e => e.id == b.id)
			if (b.type == 'text') {
				if (f && f.text != b.text) {
					updateList.push({ id: b.id, from: f.text, to: b.text })
				}
			}
		})

		if (updateList.length > 0 || d) {
			updateListPopup(d, updateList)
		}
	}
}
let updateListPopup = (updateData, updateBlockList) => {
	let change = ({ id, from, to }) => {
		let showing = reactive(false)
		let elem = dom(['.change-item',
			button('show', () => showing.next(e => !e), { class: 'mr' }),
			button('Update Block', () => {
				update_block(id, { content: to })
					.then(res => {
						if (res.status == 204) {
							notificationpopup("Updated 👍")
							elem.remove()
							elem = null
						}
						else notificationpopup("Failed? status: " + res.status)
					})
			}),
			['p', id + ": changed"],
			['.change-map', { showing },
				['.change-block.from', from],
				['.change-block.to', to],
			]])

		return elem
	}
	let layoutUpdated = false
	let root = dom(['.popup',
		button('close', () => root.remove()),
		['h4', 'Layout'],
		button("Update Layout", () => {
			if (layoutUpdated) return
			updateData.nodes.forEach(node => {
				let f = store.data.nodes.find(block => node.id == block.id)
				if (f) {
					f.x = node.x
					f.y = node.y
					f.width = node.width
					f.height = node.height
				}
			})

			store.data.edges = updateData.edges
			save_data()
			layoutUpdated = true
		},),
		['h4', "Block Changes"], ...updateBlockList.map((e) => change(e)),
	])

	document.body.appendChild(root)
	drag(root)

}
let trackpadMovement = true

document.addEventListener("wheel", e => {
	if (e.ctrlKey) {
		// trackpad...
		e.preventDefault()
		canvasScale.next(f => f - (e.deltaY / 800))
	}

	else if (e.metaKey) {
		e.preventDefault()
		canvasScale.next(f => f - (e.deltaY / 2500))
	}

	else if (trackpadMovement) {
		e.preventDefault()
		canvasY.next(f => f + e.deltaY)
		canvasX.next(f => f + e.deltaX)
	}

}, { passive: false })
window.addEventListener("gesturestart", function (e) {
	e.preventDefault();
});
window.addEventListener("gesturechange", function (e) {
	e.preventDefault();
})
window.addEventListener("gestureend", function (e) {
	e.preventDefault();
});

let checkSlugUrl = (url) => {
	if (!url.includes("#")) return
	else return url.split('#').filter(e => e != '').pop()
}
let saveCanvasToArena = () => {
	let content = JSON.stringify(store.data)
	if (state.dotcanvas?.id) {
		let description = `This block was made using [Are.na Canvas](http://canvas.a-p.space). You can view this channel as a canvas [here](http://canvas.a-p.space/#${currentslug})`
		update_block(state.dotcanvas.id, { content, title: ".canvas", description })
			.then(res => {
				if (res.status == 204) {
					notificationpopup("Updated 👍")
					updated.next(true)
				}
				else if (res.status == 401) notificationpopup("Failed: Unauthorized :( ", true)
				else notificationpopup("Failed :( status: " + res.status, true)
			})
	}
	else {
		add_block(currentslug, '.canvas', content).then((res) => {
			console.log(res)
			if (res.status == 204) {
				window.location.reload()
				// for now jsut refresh, butt todo later: 
				// fetch from v3 api so get the content.plain and then make that dotcanvas.
				// make this the dotcanvas
			}
		})
	}
}

window.onhashchange = (event) => {
	let slug = checkSlugUrl(event.newURL)
	if (slug) try_set_channel(slug)
}

let url = location.href
let slug = checkSlugUrl(url)
if (slug) try_set_channel(slug)
else set_channel(currentslug)

