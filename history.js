import { reactive, memo } from "./chowk.js"
import { store } from "./state.js"

let undoCount = reactive(0)
let redoCount = reactive(0)
store.subscribeHistory(e => {
	undoCount.next(store.undo.length)
	redoCount.next(store.redo.length)
})

export const history = () => {
	let total = 500

	let undoWidth = memo(() => {
		let t = undoCount.value() + redoCount.value()
		let per = undoCount.value() / t
		return (per * total) / undoCount.value()
	}, [undoCount, redoCount])

	let redoWidth = memo(() => {
		let t = redoCount.value() + undoCount.value()
		let per = redoCount.value() / t
		return (per * total) / redoCount.value()
	}, [undoCount, redoCount])

	let bar = (w, c, fn) =>
		['.bar',
		 { style: `background-color: ${c};width: ${w}px;` , onclick: () => console.log(fn())}]

	return ['.history',
		memo(() => [
			...Array(undoCount.value()).fill(0).map((e, i) =>
				bar(undoWidth.value(), '#2226', () => store.undo[i])),

			...Array(redoCount.value()).fill(0).map((e, i) =>
				bar(redoWidth.value(), '#0002')
			)]
			, [undoWidth, redoWidth])
	]
}
