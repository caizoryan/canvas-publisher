import { dom } from "../../lib/dom.js"
import { drag } from "./drag.js"

console.log("hello world")

let colors = ['red', 'green']
let arr = ["0", "1", ['2,0', '2, 1']]

let jsconcopy = d => JSON.parse(JSON.stringify(d))

let nested = (arr) => {
	let undo = []
	let tracking = true
	let doundo = () => {
		tracking = false
		let action = undo.pop()
		if (action) apply(...action)
		tracking = true
	}

	let apply = (location, action, value) => {
		let ref = getref(location, arr)
		if (action == 'push') {
			ref.push(value)
			if (tracking) undo.push([[...location], 'pop'])
		}

		else if (action == 'pop') {
			let removed = ref.pop()
			if (tracking) undo.push([[...location], 'push', removed])
		}

		else if (action == 'insert') {
			ref.splice(value[0], 0, value[1])
			if (tracking) undo.push([[...location], 'remove', [value[0], 1]])
		}

		else if (action == 'log') {
			console.log(ref)
		}

		else if (action == 'remove') {
			let [removed] = ref.splice(value[0], value[1])
			if (tracking) undo.push([[...location], 'insert',
			[value[0], removed]])
		}
	}
	return {
		tr: apply, arr, doundo
	}
}

let getref = (address, arr) => {
	let copy = [...address]
	let index = copy.shift()
	if (copy.length == 0) return arr[index]
	return getref(copy, arr[index])
}

let a = nested(arr)

let transactions = [
	[[2], 'push', ['2,2,0', '2,2,1']],
	[[2, 2], 'insert', [1, { "hello": "world" }]],
	[[2, 2], 'insert', [1, 'inserted after 2,2,0']],
	[[2, 2], 'insert', [2, 'inserted after previous insert']],
]

