// will basically allow me to register components and then
// when rendering, it will send each node to registery
// registery will match the type to its components
// and send back an element.

export let createRegistery = () => {
	let components = {}

	let register = (name, inputs, outputs, renderer) => {
		if (components[name]) console.error("Cant Make duplicates")
		components[name] = {
			inputs, outputs, renderer
		}
	}

	let render = (node) => {
		console.log(node)
		let {renderer, inputs, outputs} = components[node.type] 
		if (!renderer) return 
		// can also do some additional stuff like making them draggable and attaching connection points, etc
		// for inputs and outputs, the renderers are responsible to query and subscribe to the stores for their data.
		// or should the registery handle it? since it is handling the drag and stuff.
		// maybe can do that later...
		else return renderer(node)
	}

	return {register, render}
}
