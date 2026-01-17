const SVGElements = new Set([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animate",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "color-profile",
  "cursor",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignObject",
  "g",
  "glyph",
  "glyphRef",
  "hkern",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "missing-glyph",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "tref",
  "tspan",
  "use",
  "view",
  "vkern",
]);

export let isNode = (el) => el && el.nodeName && el.nodeType
/** @returns {HTMLElement} */
export let dom = (tag, ...contents) => {
	if (isNode(tag)) return tag

	let el = "div"
	let classes = []
	let id = ""

	if (Array.isArray(tag)
			&& contents.length == 0
			&& typeof tag[0] != 'string'
		 ) return tag.map(dom) 
	else if (Array.isArray(tag)) return dom(...tag.concat(contents))

	// parse class
	let identifiers = tag.split(/([\.#]?[^\s#.]+)/).map(e => e.trim()).filter(e => e != "")

	if (!(/^\.|#/.test(identifiers[0]))) {
		el = identifiers[0]
		identifiers.shift()
	}

	identifiers.forEach(i => {
		if (i[0] == ".") classes.push(i.slice(1))
		if (i[0] == "#") id = i.slice(1)
	})

	let doc = SVGElements.has(el)
            ? document.createElementNS("http://www.w3.org/2000/svg", el)
            : document.createElement(el);


	if (classes.includes("list-item")){console.log("items",contents)}
	classes.forEach((c) => doc.classList.add(c))
	id ? doc.id = id : null

	contents.forEach((e) => {
		if (e == undefined) {return}
		if (typeof e == 'string') doc.appendChild(new Text(e))
		else if (e.isReactive) {
			// check if it is marked reactive
			// then check what the value is
			// if value is string...
			let v = e.value()
			if (typeof v == 'string' || typeof v == "number") {
				let node = new Text(typeof v == 'number' ? v.toString() : v)
				// destroy this when destroying text
				e.subscribe((vv) => node.textContent = vv)
				doc.appendChild(node)
			}
			else if (Array.isArray(v)){
				// TODO: if outer dom is reactive, this will run everytime....
				if (typeof v[0] == 'string') {
					let node = dom(v)
					doc.appendChild(node)
					e.subscribe((vv) => {
						// TODO: check if vv is same...
						let newnode = dom(vv)
						node.replaceWith(newnode)
						node = newnode
					})

					return
				}

				// if its an array there make a list
				let nodes = v.map((e) => dom(e))
				nodes.forEach(n => doc.appendChild(n))

				e.subscribe((vv) => {
					let newnodes = vv.map((e)=> dom(e))
					let diff = newnodes.length - nodes.length
					// if negative, have to delete

					if (diff < 0) {
						for (let i = 0; i < (diff*-1); i++) {
							// REMOVE AND THEN REMOVE FROM NODES
							// THIS MIGHT BE THE LEAK
							nodes[(nodes.length - 1) - i].remove()
						}
					}

					newnodes.forEach((n, i) => {
						if (i > nodes.length - 1 ) return
						nodes[i].replaceWith(n)
					})

					if (diff > 0) {
						for (let i = nodes.length; i < nodes.length + diff; i++){
							doc.appendChild(newnodes[i])
						}
					}

					nodes=newnodes
				})
			}

		}
		else if (Array.isArray(e)) doc.appendChild(dom(...e))
		else if (isNode(e)) doc.appendChild(e)
		else if (typeof e == 'object') Object.entries(e).map(([k, v]) => {
			if (v == undefined) return
			if (v.isReactive) {
				doc.setAttribute(k, v.value())
				// this is why detatched elements are still in dom....
				// have to clean this up... somehow...
				v.subscribe(vv => doc.setAttribute(k, vv))
			}
			else {
				if (typeof v == 'function') doc[k] = v
				else doc.setAttribute(k, v)
			}
		})
	})

	return doc
}
