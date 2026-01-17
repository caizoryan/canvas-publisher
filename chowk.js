let scope = () => null
export function reactive(value) {
	let subs = {}
	let count = 0
	let t = {
		value: () => (scope(t), value),
		next: (v) => {
			let _value
			typeof v == 'function'
				? _value = v(value)
				: _value = v

			if ((typeof _value == 'number'|| typeof _value == 'string')
					&& _value == value) return
			else {
				value = _value
				Object.values(subs).forEach(e =>  e(value))
			}

		},

		isReactive: true,
		subscribe: (fn) => {
			let id = count++
			// fn(value)
			subs[id] = fn
			return () => delete subs[id]
		},
	}

	return t
}
export function memo (fn, subs /*,subs*/)  {
	// let subs = []
	let subbers = []
	// scope = (v) => {
	// 	subs.push(v)
	// }
	let value = fn()
	// scope = () => null
	let memoized = subs.map(v => v.value)
	let run = () => {
		value = fn()
		subbers.forEach((s) => s(value))
	}

	subs.forEach((s, i) => {
		s.subscribe((v) => {
			// check once and if any has changed mark for running... dont do all.
			// will run multiple times
			// if (Array.isArray(v)
			// 		// || memoized[i] != v
			// 	 ) {
				// then run
				memoized[i] = v
				run()
			// }
			// else return
		})
	})

	let t = {
		isReactive: true,
		value: () => (scope(t),value),
		subscribe: (fn) => {
			// fn(value)
			subbers.push(fn)
		}
	}

	return t
}

// function history(reactive) {
// 	let undo = []
// 	let redo = []
// 	return {
// 		value: reactive.value,
// 		subscribe: reactive.subscribe,
// 		next: (v) => {
// 			undo.push(reactive.value())
// 			redo = []
// 			reactive.next(v)
// 		},
// 		isReactive: true,
// 		canUndo: () => (undo.length > 0),
// 		canRedo: () => (redo.length > 0),
// 		listUndo: () => undo,
// 		listRedo: () => undo,
// 		undo: () => {
// 			if (undo.length == 0) return undefined
// 			redo.push(reactive.value())
// 			reactive.next(undo.pop())
// 			return reactive.value()
// 		},

// 		redo: () => {
// 			if (redo.length == 0) return undefined
// 			undo.push(reactive.value())
// 			reactive.next(redo.pop())
// 			return reactive.value()
// 		}
// 	}
// }
