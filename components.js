import { reactive, memo } from "./chowk.js"
import { svgArrow, svgx} from "./svg.js"
import {dom} from "./dom.js"
import { drag } from "./drag.js"
import {state,
				store, 
				dataSubscriptions,
				canvasScale, 
				dimensions } from "./state.js"
import {colors, keys } from './script.js'

let blue = "#68A0D4"
let red = "#D46883"

// -------------------
// utils
// -------------------
const round = (value, precision)=> {
	let multiplier = Math.pow(10, precision || 0);
	return Math.round(value * multiplier) / multiplier;
}
const mapRange = (value, inMin, inMax, outMin, outMax) => 
	 (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

// --------------
// NODE: UI Elements
// --------------
let inputConnector = (left, top, signal, position, label, side= 's', cssside = 'left') => {
	let bufferkill = reactive("false")
	let colorx = memo(() => bufferkill.value() == 'false' ? '#0002' : red, [bufferkill])

	let style = `${cssside}: ${left}px; top: ${top}px;`
	let element_x = dom(['.connection.input', {
		title: '('+label + '): Input',
		style,
		onclick: () => {
			if (bufferkill.value() != 'false') {
				bufferkill.value().disconnect()
				bufferkill.next('false')
			}

			else if (state.nodeConnectionBuffer) {
				bufferkill.next(state.nodeConnectionBuffer)
				state.nodeConnectionBuffer.connectAsOutput(signal, position)
			}
		}
	}, svgArrow(side, 20, 20, colorx)])

	return element_x
}
let outputConnector = (left, top, signal, position, label, side = 's', cssside = 'right') => {
	return dom(['.connection.output', {
		title: '('+label + '): Output',
		style: `top: ${top}px; ${cssside}: ${left}px;`,
		onpointerdown: e => {
			e.preventDefault()
			e.stopImmediatePropagation();
			e.stopPropagation();
		},
		onclick: (e) => {
			e.preventDefault()
			e.stopImmediatePropagation();
			e.stopPropagation();

			if (state.nodeConnectionBuffer) { state.nodeConnectionBuffer = undefined }
			else {
				state.nodeConnectionBuffer = createConnection()
				state.nodeConnectionBuffer.connectAsInput(signal, position)
			}
		}
	}, svgArrow(side, 20, 20, blue)])
}

export let slidercursor = ({
	left, top,
	width,
	height,
	value,
}) => {
	let scaled = width/dimensions
	// will figure this out one day
	let ughw = memo(() => scaled * (window.innerWidth), [canvasScale])
	let ughh = memo(() => (scaled * window.innerHeight), [canvasScale])

	let dataplug = reactive(store.data)
	dataSubscriptions.push(f =>{dataplug.next(f)})

	let mappednodes = memo(() => dataplug.value().nodes.map(e => {
		let n = {}
		n.x = e.x * scaled
		n.y = e.y * scaled
		n.width = e.width*scaled
		n.height = e.height*scaled
		n.type = e.type
		n.color = colors[parseInt(e.color) - 1]
		return n
	}).sort((a, b) => a.type == 'group' ? -1 : 1).map(e => {

		let style = `
position: absolute;
left: ${e.x}px;
top: ${e.y}px;
width: ${e.width}px;
height: ${e.height}px;
background-color:${e.color}88; 
border: 2px solid ${e.color}; 
`
		return [".mini", {style}]
	}), [dataplug])

	let y = reactive(value)
	let x = reactive(value)

	left = reactive(left)
	top = reactive(top)

	let iny_left = memo(() => left.value() + width + 40, [left])
	let iny_top = memo(() =>   top.value() + height - 40,[top])

	let outy_left = memo(() => left.value() + width + 40, [left])
	let outy_top = memo(() => top.value() + 65, [top])

	let inx_left = memo(() => left.value() + width - 55, [left])
	let inx_top = memo(() => top.value(), [top])

	let outx_left = memo(() => left.value()+30, [left])
	let outx_top = memo(() => top.value(), [top])


	let connectinput_x = inputConnector(width-80, -30, x, [inx_left, inx_top], "X")
	let connectoutput_x = outputConnector(5, -30, x, [outx_left, outx_top], "X", 'n', 'left')

	let connectinput_y = inputConnector(width, height - 80, y, [iny_left, iny_top], "Y", 'w')
	let connectoutput_y = outputConnector(width, 40, y, [outy_left, outy_top], "Y", 'e', 'left')

	let style = memo(() => `
		left: ${left.value()}px;
		top: ${top.value()}px;
		height: calc(${height}px + 2em);
		width: calc(${width}px + 2em);
	`, [left, top])

	let stylememo = memo(() => `
		top: ${y.value()}px;
		left: ${x.value()}px;
		background-color: #fff5; 
border: 2px solid blue;
width: ${ughw.value()}px;
height: ${ughh.value()}px;
`, [x, y, ughw, ughh])

	let cursor = dom(['.psuedo-cursor', { style: stylememo }], svgx(ughw, ughh, 'blue', 1))
	let el = dom(
		['.psuedo-container', { style: style },
			['.psuedo-slider',
				{ style: `height: ${height}px;width: ${width}px;` },
				mappednodes,
				cursor, connectoutput_x, connectoutput_y,
				connectinput_x, connectinput_y,]])

	setTimeout(() => {
		let set_top = (v) => y.next(v)
		let set_left = (v) => x.next(v)
		drag(cursor, { set_left, set_top })
		drag(el, { set_left: (v) => left.next(v), set_top: (v) => top.next(v) })
	}, 100)

	return el
}
export let sliderAxis = ({
	top, left,
	axis,
	width,
	height,
	min, max,
	value,
	input, output,
	label = ''
}) => {
	let dimensionmax = axis == 'horizontal' ? width : height
	let mapper = (v) => mapRange(v, 0, dimensionmax, min, max)
	let reversemapper = (v) => mapRange(v, min, max, 0, dimensionmax)

	left = reactive(left)
	top = reactive(top)

	let in_left = memo(() => left.value() + 5, [left])
	let in_top = memo(() => top.value() - 15, [top])

	let out_left = memo(() => left.value() + width + 5, [left])
	let out_top = memo(() => top.value() + height + 15, [top])

	let style = memo(() => `
		left:${left.value()}px;
		top:${top.value()}px;
		width: ${width}px;
		height: ${height}px;
`, [left, top])

	let x = reactive(reversemapper(value))
	if (input) input.subscribe(v => x.next(reversemapper(v)))
	if (output) x.subscribe(v => output.next(mapper(v)))

	let stylememo = memo(() => `
		left: ${axis == 'horizontal' ? x.value() : -8}px;
		top:  ${axis == 'vertical' ? x.value() : -8}px;`, [x])

	let connectinput = inputConnector(-8, -36, x, [in_left, in_top], label, axis == 'horizontal' ? 'e' : 's')
	let connectoutput = outputConnector(-8, height + 5, x, [out_left, out_top], label,axis == 'horizontal' ? 'e' : 's')

	let cursor = dom(['.psuedo-cursor.flex-center', { style: stylememo }, label])
	let el = dom(['.psuedo-slider', { style }, cursor, connectoutput, connectinput])

	setTimeout(() => {
		let set_left = (v) => axis == 'horizontal' ? x.next(v) : null
		let set_top = (v) => axis == 'vertical' ? x.next(v) : null

		drag(cursor, { set_left, set_top })
		drag(el, { set_left: (v) => left.next(v), set_top: (v) => top.next(v) })
	}, 100)

	return el
}
export let reactiveEl = ({ left, top, value }) => {
	let width = 80

	left = reactive(left)
	top = reactive(top)
	let out_left = memo(() => left.value() + width + 45, [left])
	let out_top = memo(() => top.value() + 5, [top])
	let in_left = memo(() => left.value() - 15, [left])
	let in_top = memo(() => top.value() + 5, [top])

	let input = inputConnector(-35, 0, value, [in_left, in_top])
	let output = outputConnector(-35, 0, value, [out_left, out_top])

	let style = memo(() => `
		left:${left.value()}px;
		top:${top.value()}px;
		width: ${width}px;
		padding: 1em;
`, [left, top])

	let el = dom(['div.psuedo-slider', { style },
		['div.psuedo-cursor',
			{ style: `left: 5px; top:0px; width: 50` },
			memo(() => round(value.value(), 5) + "", [value])], input, output])
	setTimeout(() => {
		drag(el, { set_left: (v) => left.next(v), set_top: (v) => top.next(v) })
	}, 100)
	return el

}
export let keyPresser = ({ left, top, key }) => {
	let width = 80

	let inputvalue = reactive(0)
	let outputvalue = reactive(0)
	left = reactive(left)
	top = reactive(top)
	let out_left = memo(() => left.value() + width + 45, [left])
	let out_top = memo(() => top.value() + 5, [top])
	let in_left = memo(() => left.value() - 15, [left])
	let in_top = memo(() => top.value() + 5, [top])

	let input = inputConnector(-35, 0, inputvalue, [in_left, in_top])
	let output = outputConnector(-35, 0, outputvalue, [out_left, out_top])

	keys.push({
		key,
		fn: () => {
			outputvalue.next(Math.random())
			outputvalue.next(inputvalue.value())
		}
	})

	let style = memo(() => `
		left:${left.value()}px;
		top:${top.value()}px;
		width: ${width}px;
		padding: 1em;
`, [left, top])

	let el = dom(['div.psuedo-slider', { style },
		['div.psuedo-cursor',
			{ style: `left: 5px; top:0px; width: 50` }, key], input, output])
	setTimeout(() => {
		drag(el, { set_left: (v) => left.next(v), set_top: (v) => top.next(v) })
	}, 100)
	return el

}
export let keyVisualiser = ({ left, top }) => {
	let width = 80
	let metaKey = reactive(false)
	let shiftKey = reactive(false)
	let key = reactive('')
	let timeout

	left = reactive(left)
	top =  reactive(top)

	let reset = () => {
		key.next('')
		shiftKey.next(false)
		metaKey.next(false)
	}

	keys.push({
		key,
		fn: (e) => {
			reset()
			if (timeout) clearTimeout(timeout)
			if (e.key){
				if (e.key.length == 1) key.next(e.key.toUpperCase())
				else if (e.key == 'Escape') key.next('␛')
			}
			if (e.shiftKey) shiftKey.next(true)
			if (e.metaKey) metaKey.next(true)
			// timeout = setTimeout(reset, 4000)
		}
	})

	let style = memo(() => `
		left:${left.value()}px;
		top:${top.value()}px;
		width: ${width}px;
		padding: 1em;
`, [left, top])

	let keyPress = memo(() => {
		let k = ''
		if (metaKey.value()) k += '⌘'
		if (shiftKey.value()) k += '⇧'
		k += key.value()

		return k
	}, [metaKey, shiftKey, key])

	let el = dom(['button.psuedo-slider', { style }, keyPress])

	setTimeout(() => {
		drag(el, { set_left: (v) => left.next(v), set_top: (v) => top.next(v) }, )
	}, 100)
	return el

}


// --------------
// NODE: Connection
// --------------

// connection:
// connectAsInput
// connectAsOutput

// createConnection ->
// will create a closure with a signal
// an input fn that writes to the signal
// and an output fn that subscribes to signal
export function createConnection() {
	let signal = reactive(0)
	let disconnectInput, disconnectOutput
	let start, end
	// let id = uuid
	let self = {
		line: () => {
			let l = []
			if (start && !end) l = [...start]
			else if (start && end) l = [...start, ...end]
			return l
		},
		connectAsInput: (v, position) => {
			if (position.isReactive) {
				start = position.value()
				position.subscribe(v => start = v)
			}
			else start = position
			signal.next(v.value())
			disconnectInput = v.subscribe(x => signal.next(x))
		},

		connectAsOutput: (v, position) => {
			if (position.isReactive) {
				end = position.value()
				position.subscribe(v => end = v)
			}

			else end = position

			v.next(signal.value())
			disconnectOutput = signal.subscribe(x => v.next(x))
			state.connections.push(self)
			state.nodeConnectionBuffer = undefined
		},

		disconnect: () => {
			// delete line
			disconnectInput()
			disconnectOutput()
			let us = state.connections.findIndex(v => v == self)
			if (us != -1) state.connections.splice(us, 1)
		}
	}
	return self
}
