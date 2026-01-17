import { update_block } from "./arena.js"
import { reactive, memo } from "./chowk.js"
import { dom } from "./dom.js"
import { drag } from "./drag.js"
import { MD } from "./md.js"
import { notificationpopup } from "./notification.js"
import { getNodeLocation, store, subscribeToId, state, addNode, addEdge, removeNode } from "./state.js"
import { svgx } from "./svg.js"

// ---------
// Utilities
// ~~~~~~~~~
export const uuid = () => Math.random().toString(36).slice(-6);
export const button = (t, fn, opts = {}) => ['button', { onclick: fn, ...opts }, t]
export const unwrap = t => t.isReactive ? t.value() : t
export const CSSTransform = (x, y, width, height) => {
	let v = `
		position: absolute;
		left: ${unwrap(x)}px;
		top: ${unwrap(y)}px;`

	if (width != undefined) v+= `width: ${unwrap(width)}px;`
	if (height != undefined)v += `height: ${unwrap(height)}px;`

	return v
}

export const Transform = (x, y, width, height) => ({ x, y, width, height })
export const Color = i => 'background-color: var(--b' + i + ');'
export const isRectContained = (rect1, rect2) => {
	return (
		rect2.x >= rect1.x &&
		rect2.y >= rect1.y &&
		rect2.x + rect2.width <= rect1.x + rect1.width &&
		rect2.y + rect2.height <= rect1.y + rect1.height
	);
}
const convertBlockToV3 = block => {
	if (block.class) {
		block.type = block.class
		if (block.type == 'Text') {
			block.content = { markdown: block.content, }
		}
		// if has image the change url to src or whatever
	}

	if (block.type == 'Channel') block.id = 'c' + block.id

	return block
}

// Reactive interface:
// ~> (to plug into the store)
// ~~~~~~~~~~~~~~~~~~~
let R = (location, id) => key => ({
	isReactive: true,
	value: () => store.get(location.concat([key])),
	next: (v) => store.tr(location, 'set', [key, v]),
	subscribe: (fn) => subscribeToId(id, [key], fn)
})

let groupTitleLabel = group => {
	let location = getNodeLocation(group.id)
	let r = R(location, group.id)
	let label = r('label')

	let editingLabel = reactive(false)
	let textLabel = () => ['h4', { onclick: () => { editingLabel.next(true) } }, label]
	let editLabel = () => ['div', ['input',
		{
			oninput: (e) => { label.next(e.target.value) },
			onkeydown: (e) => {
				if (e.key == 'Enter') editingLabel.next(false)
				if (e.key == 'Escape') editingLabel.next(false)
			},
			value: label
		}],

		button("set", () => editingLabel.next(false))]

	let title = dom(['.label', memo(() => editingLabel.value() ? editLabel() : textLabel(), [editingLabel])])

	return title
}
let colorBars = (node, btn = ['span']) => {
	let r = R(getNodeLocation(node.id), node.id)
	let color = r('color')
	let setcolorfn = i => () => color.next(i + "")
	let colorbuttons = ['.color-bar', ...[1, 2, 3, 4, 5, 6].map((i) => button('x', setcolorfn(i), { style: 'background-color: var(--b' + i + ");" })), btn]
	return colorbuttons
}


// ------------------
// Block and Group El
// ------------------
export function BlockElement(block) {
	// Convert From  v3 to v2 incase
	block = convertBlockToV3(block)
	let location = getNodeLocation(block.id)

	if (!location) {
		let newNode = constructBlockData(block, 0)
		addNode(newNode)
		location = getNodeLocation(block.id)
	}

	let r = R(location, block.id)

	let left = r('x')
	let top = r('y')
	let color = r('color')
	let height = r('height')
	let width = r('width')
	let isSelected = memo(
		() => state.selected.value().includes(block.id), [state.selected])

	let isMultiSelected = memo(
		() => state.selected.value().length > 1
			&& state.selected.value().includes(block.id), [state.selected])

	let addToSelection = (e) => {
		if (e.shiftKey) state.selected.next(e => [...e, block.id])
		else state.selected.next([block.id])
	}

	let style = memo(() =>
		CSSTransform(left, top, width, height)
		+ Color(color.value()),
		[left, top, width, height, color])

	let el, components, attributes

	switch (block.type) {
		case "Text":
			[el, components, attributes] = TextBlock(block); break;
		case "Image":
			[el, components, attributes] = ImageBlock(block); break;
		case "Embed":
			[el, components, attributes] = EmbedBlock(block); break;
		case "Attachment":
			[el, components, attributes] = AttachmentBlock(block); break;
		case "Link":
			[el, components, attributes] = LinkBlock(block); break;
		case "Media":
			[el, components, attributes] = MediaBlock(block); break;
		case "Channel":
			[el, components, attributes] = Channel(block); break;
	}

	let t = ['.top-bar', colorBars(block)]

	if (components && components["edit-controls"]) {
		t.push(components["edit-controls"])
	}

	let b = ['.bottom-bar', ...Object.values(BasicComponents(block))]

	let onstart = (e) => {
		addToSelection(e)
		store.startBatch()
		// saves this location for undo
		left.next(left.value())
		top.next(top.value())
		width.next(width.value())
		height.next(height.value())
		store.endBatch()

		store.pauseTracking()
	}

	let onend = () => store.resumeTracking()

	let edges = resizers(left, top, width, height, { onstart, onend })

	let connectionEdges = connectors(block, left, top, width, height)

	el = dom('.draggable.node', {
			style,
			"block-id": block.id,
			...attributes,
			selected: isSelected,
			'multi-selected': isMultiSelected,
			// onclick: addToSelection,
		}, t, el, ...edges,...connectionEdges, b,)

	setTimeout(() => {
		drag(el, {
			onstart,
			onend,
			pan_switch: () => attributes?.edit ? !attributes.edit.value() : true,
			set_position: (x, y) => {
				left.next(x)
				top.next(y)
			},
		})
	}, 50)

	return el
}
export function GroupElement(group) {
	// Convert From  v3 to v2 incase
	let r = R(getNodeLocation(group.id), group.id)
	let anchored = []

	let left = r('x')
	let top = r('y')
	let color = r('color')
	let height = r('height')
	let width = r('width')

	let style = memo(() =>
		CSSTransform(left, top, width, height) + Color(color.value())
		, [left, top, width, height, color])


	let onstart = (e) => {
		state.selected.next([])

		// saves this location for undo
		store.startBatch()

		if (!e.metaKey){
			store.get(['data', 'nodes']).forEach((e, i) => {
				if (isRectContained(
					Transform(
						left.value(), top.value(),
						width.value(), height.value()), e)
				) {
					let item = {
						blockLocation: ['data', 'nodes', i],
						position: { x: e.x, y: e.y },
						offset: {
							x: e.x - left.value(),
							y: e.y - top.value(),
						}
					}
					anchored.push(item)
				}
			})

			anchored.forEach((e, i) => {
				store.tr(e.blockLocation, 'set', ['x', e.position.x])
				store.tr(e.blockLocation, 'set', ['y', e.position.y])
			})
		}

		else {
			left.next(left.value())
			top.next(top.value())
			width.next(width.value())
			height.next(height.value())
		}

		store.endBatch()
		store.pauseTracking()
	}
	let onend = () => {
		store.resumeTracking()
		anchored = []
	}

	let remove = () => {
		removeNode(group)
		el.remove()
	}

	let removeButton = () => {
		let click = reactive(0)
		let words = ['delete', 'DELETE', "DELETE!", "DELEETEEEE!!!!"]
		let onclick = () => {
			click.next(e => e + 1)
			if (click.value() == words.length) remove()
		}
		return button(memo(() => words[click.value()], [click]), onclick)
	}

	let edges = resizers(left, top, width, height, { onstart, onend })
	let connectionEdges = connectors(group, left, top, width, height)
	let el = dom('.draggable.group', { style }, colorBars(group, removeButton()), groupTitleLabel(group), ...edges, ...connectionEdges)

	setTimeout(() => {
		drag(el, {
			onstart,
			onend,
			set_position: (x, y) => {
				left.next(x)
				top.next(y)

				anchored.forEach((e) => {
					store.tr(e.blockLocation, 'set', ['x', x + e.offset.x])
					store.tr(e.blockLocation, 'set', ['y', y + e.offset.y])
				})
			},
		})
	}, 50)

	return el
}

export const resizers = (left, top, width, height, opts = {}) => {
	let MainCorner = dom(".absolute.flex-center.box.cur-se", {
		style: memo(() => CSSTransform(
			width.value() - 15,
			height.value() - 15,
			30, 30
		), [width, height])
	}, svgx(30))
	let WidthMiddle = dom(".absolute.flex-center.box.cur-e", {
		style: memo(() => CSSTransform(
			width.value() - 15,
			height.value() / 4,
			30,
			height.value() / 2), [width, height])
	}, svgx(30))
	let HeightMiddle = dom(".absolute.flex-center.box.cur-s", {
		style: memo(() => CSSTransform(
			width.value() / 4,
			height.value() - 15,
			width.value() / 2,
			30), [width, height])
	}, svgx(30))

	setTimeout(() => {
		drag(MainCorner, {
			set_position: (x, y) => {
				width.next(x)
				height.next(y)
			},
			...opts,
		})
		drag(WidthMiddle, {
			set_left: (v) => width.next(v), set_top: () => null, ...opts,
		})
		drag(HeightMiddle, {
			set_left: () => null, set_top: (v) => height.next(v), ...opts,
		})
	}, 100)

	return [MainCorner, WidthMiddle, HeightMiddle]
}
export const connectors = (block, left, top, width, height, opts = {}) => {
	let unwrapFn = v => typeof v  == 'function' ? v() : v
	let connectionPoint = (side, x, y) => dom('.edge-connector.absolute.flex-center.box', {
		style: memo(() => CSSTransform(unwrapFn(x), unwrapFn(y)), [height, width]),
		onpointerdown: e => {
			e.stopImmediatePropagation()
			e.stopPropagation()

			if (state.block_connection_buffer) {
				// add edge

				document.querySelectorAll('.wobble').forEach(e => {
					e.classList.toggle('wobble')
				})

				state.connectionFromX.next(0)
				state.connectionFromY.next(0)
				state.connectionToX.next(0)
				state.connectionToY.next(0)

				if (state.block_connection_buffer.fromNode == block.id) {
					state.block_connection_buffer = undefined
					notificationpopup("Can't connect to self", true)
					return
				}

				addEdge({
					id: uuid(),
					...state.block_connection_buffer,
					toNode: block.id,
					toSide: side
				})

				state.block_connection_buffer = undefined
			}

			else {
				e.target.classList.toggle('wobble')

				console.log(left.value() + unwrapFn(x), top.value() + unwrapFn(y))
				state.connectionFromX.next(left.value() + unwrapFn(x))
				state.connectionFromY.next(top.value() + unwrapFn(y))
				state.connectionToX.next(left.value() + unwrapFn(x))
				state.connectionToY.next(top.value() + unwrapFn(y))

				state.block_connection_buffer = {
					fromNode: block.id, fromSide: side
				}
			}
		}, 
	}, 'X')

	let connectionPoints = [
		connectionPoint('top', () => width.value() / 2, -15),
		connectionPoint('left', -15, () => height.value() / 2),
		connectionPoint('bottom',
										() => width.value() / 2,
										() => height.value() - 15),
		connectionPoint('right', () => width.value() - 15, height.value() / 2),
	]

	return connectionPoints
}

const TextBlock = (block) => {
	let root = dom('.block')
	let child = dom(['.block.text', ...MD(block.content.markdown)])
	root.appendChild(child)

	let attributes = {
		edit: reactive(false)
	}

	let owned = memo(() => state.authSlug.value() == block.user?.slug,
		[state.authSlug])

	let value = block.content?.markdown
	let old = ''
	let wc = reactive(value?.split(" ").length)
	let reset = () => root.innerHTML = ''

	let editBlock = (e) => {
		e.stopImmediatePropagation()
		e.stopPropagation()
		if (attributes.edit.value()) return
		attributes.edit.next(true)
		reset()
		child = dom(['.block.text', textarea(value)])
		root.appendChild(child)
	}
	attributes.ondblclick = editBlock
	let editButton = button('edit', editBlock)

	let saveBlock = () => {
		attributes.edit.next(false)
		update_block(block.id, { content: value })
			.then(res => {
				if (res.status == 204) notificationpopup("Updated 👍")
				else if (res.status == 401) notificationpopup("Failed: Unauthorized :( ", true)
				else notificationpopup("Failed :( status: " + res.status, true)
			})
		reset()

		child = dom(['.block.text', ...MD(value)])
		root.appendChild(child)
	}
	let saveButton = dom(button("save", saveBlock))

	let cancelEdit = () => {
		setValue(old)
		attributes.edit.next(false)
		reset()
		root.appendChild(dom([".block.text", ...MD(value)]))
	}
	let cancelButton = dom(button('cancel', cancelEdit))

	let blockUserTag = ["p.tag", block.user?.slug]

	let editOrTagOrSave = memo(() => attributes.edit.value()
		? owned ? [saveButton, cancelButton] : [cancelButton]
		: owned && block.type == 'Text'
			? [editButton]
			: [blockUserTag],
		[state.authSlug, attributes.edit])

	let setValue = (t) => {
		wc.next(t.split(' ').length)
		value = t
	}

	let textarea = md => {
		old = value
		return dom(["textarea", {
			oninput: e => setValue(e.target.value),
			onkeydown: e => {
				if (e.key == 's' && (e.metaKey || e.ctrlKey)) saveBlock()
			}
		}, md])
	}

	let comps = {
		"edit-controls": editOrTagOrSave,
	}

	return [root, comps, attributes]
}
const ImageBlock = (block) => {
	let link = block.image?.large?.src || block.image?.large?.url
	return [['.block.image', ['img', { src: link }]], {}, {}]
}
const LinkBlock = ImageBlock
const MediaBlock = ImageBlock
const EmbedBlock = ImageBlock
const AttachmentBlock = ImageBlock
const Channel = block => {
	return [[".block.channel",
		['h2', block.title],
		['h4', ['strong', block.slug]],
		['p', ['a', { href: "#" + block.slug }, button('Open in Canvas')]],
		['p', ['a',
			{ href: "https://are.na/channel/" + block.slug },
			button('View on Are.na')]
		], {}, {}]
	]
}

const BasicComponents = (block) => {
	let copyLink = button("copy", (e) => {
		let link = "https://are.na/block/" + block.id
		if (e.metaKey) link = `[title](${link})`
		navigator.clipboard.writeText(link)
	})

	let jumpToArena = button("", (e) => {
		let link = "https://are.na/block/" + block.id
		window.open(link, '_blank').focus();
	})

	return {
		'copy-link': copyLink,
		'jump-to-are.na': jumpToArena
	}
}

export let constructBlockData = (e, i) => {
	let padding = 400
	let d = {
		id: e.id,
		width: 300,
		height: 300,
		color: '1'
	}
	if (typeof i == 'number') {
		d.x = (i % 8) * 400 + padding
		d.y = (Math.floor(i / 8)) * 450 + padding
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
export let constructGroupData = (x, y, width, height) => {
	let d = {
		type: 'group',
		label: "Group",
		id: 'group-' + uuid(),
		x, y, width, height,
		color: '6',
	}

	return d
}
