import { memo, reactive } from "./chowk.js"
import { updated } from "./script.js"
export let meData = {}
export let authslug = reactive('')
export const dimensions = 10000

let t = localStorage.getItem('transform')
if (t) t=JSON.parse(t)
else t = {x: 0, y: 0, scale: 1}

export let mouse = reactive({ x: 0, y: 0 })
export let canvasX = reactive(t.x)
export let canvasY = reactive(t.y)
export let canvasScale = reactive(t.scale)
export let selected = reactive([])


memo(() => {
	canvasScale.value() < 0.1 ? canvasScale.next(.1):null
	canvasScale.value() > 2.3 ? canvasScale.next(2.3):null

	localStorage.setItem("transform", JSON.stringify({
		x: canvasX.value(),
		y: canvasY.value(),
		scale: canvasScale.value()
	}))

}, [canvasX, canvasY, canvasScale])

export let store = {data: undefined}

export let state = {
	blockConnectionBuffer: undefined,
	nodeConnectionBuffer: undefined,
	dotcanvas: undefined,
	selectedConnection: undefined,
	connections: [],
}

export let dataSubscriptions = []
export let save_data = () => {
	updated.next(false)
	localStorage.setItem("canvas", JSON.stringify(store.data))
	dataSubscriptions.forEach(fn => fn((() => store.data)()))
}
