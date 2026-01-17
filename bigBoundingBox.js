import { memo } from "./chowk.js"
import { dom } from "./dom.js"
import { drag } from "./drag.js"
import { getNodeLocation, state, store } from "./state.js"
import { svgx } from "./svg.js"
drag

export let mountBoundingBox = () => {
	let anchored = []
	let boundingAnchor = {}
	let dimsMemo = memo(() => {
		anchored = []
		let selection = store.get(['data', 'nodes'])
			.filter(e => state.selected.value().includes(e.id))

		selection.forEach(e => {
			let item = {
				blockLocation: getNodeLocation(e.id),
				offset: { x: e.x, y: e.y }
			}
			anchored.push(item)
		})

		let dimension = selection.reduce((acc, e, i) => {
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
		return { dimension, selection }
	}, [state.selected])

	let dawgWalkers = memo(() => {
		let { dimension, selection } = dimsMemo.value()

		boundingAnchor = {
			x: dimension.x,
			y: dimension.y,
			width: dimension.x2 - dimension.x,
			height: dimension.y2 - dimension.y,
		}

		if (selection.length > 1) {
			return `
			left: ${dimension.x}px;
			top: ${dimension.y}px;
			width: ${dimension.x2 - dimension.x}px;
			height: ${dimension.y2 - dimension.y}px;
			border: 4px solid var(--bor6);`
		}

		else return ''
	}, [dimsMemo])

	let bigbox = dom('.absolute.big-box', { style: dawgWalkers },
		memo(() => {
			let { dimension, sel } = dimsMemo.value();
			let { x2, x, y2, y } = dimension
			x2 = x2 || 1
			x = x || 1
			y = y || 1
			y2 = y2 || 1
			return svgx(x2 - x, y2 - y, '#E3CFF5')
		}, [dimsMemo]))


	let onstart = () => {
		// saves this location for undo
		store.startBatch()
		anchored.forEach((e, i) => {
			let x = store.get(e.blockLocation.concat(['x']))
			let y = store.get(e.blockLocation.concat(['y']))
			store.tr(e.blockLocation, 'set', ['x', x])
			store.tr(e.blockLocation, 'set', ['y', y])
		})
		store.endBatch()
		store.pauseTracking()
	}

  let onend = () => {
		store.resumeTracking()
	}

	let set_position = (x, y) => {
		let diff = {
			x: x - boundingAnchor.x,
			y: y - boundingAnchor.y
		}

		anchored.forEach((e) => {
			store.tr(e.blockLocation, 'set', ['x', e.offset.x + diff.x])
			store.tr(e.blockLocation, 'set', ['y', e.offset.y + diff.y])
		})

		bigbox.style.left = x + 'px'
		bigbox.style.top = y + 'px'
	}

	setTimeout(() => {

		drag(bigbox, { set_position, onstart, onend })
	}, 150)

	return bigbox
}
