// will basically allow me to register components and then
// when rendering, it will send each node to registery
// registery will match the type to its components
// and send back an element.
import { R } from "./canvas.js";
import { memo, reactive } from "./chowk.js";
import { dom } from "./dom.js";
import { Color, connectors, CSSTransform, resizers, uuid } from "./block.js";
import { drag } from "./drag.js";

import {
	addNode,
	BUFFERS,
	EDGEMAP,
	getNodeLocation,
	NODES,
	state,
	store,
	subscribeToId,
} from "./state.js";

export let addToSelection = (block, e) => {
	if (e.shiftKey) state.selected.next((e) => [...e, block.id]);
	else state.selected.next([block.id]);
};

let nodeContainer = (node, attr, children) => {
	let r = R(getNodeLocation(node.id), node.id);

	let left = r("x");
	let top = r("y");
	let color = r("color");
	let height = r("height");
	let width = r("width");

	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);

	let onstart = (e) => {
		if (e.altKey) {
			// copy all props and make new
			let n = {};
			n.id = uuid();
			n.type = node.type;
			n.x = left.value() + 50;
			n.y = top.value() + 50;
			n.width = width.value();
			n.height = height.value();
			n.color = color.value();
			let d = { ...store.get(getNodeLocation(node.id).concat(["data"])) };
			n.data = d;

			addNode(n);
			return;
		}
		addToSelection(node, e);

		store.resumeTracking();
		store.startBatch();

		left.next(left.value(), true);
		top.next(top.value(), true);
		width.next(width.value(), true);
		height.next(height.value(), true);

		store.endBatch();
		store.pauseTracking();
	};
	let onend = () => {
		store.resumeTracking();
	};

	let edges = resizers(left, top, width, height, { onstart, onend });
	let connects = connectors(node, left, top, width, height);

	// Door
	setTimeout(() => {
		drag(el, {
			onstart,
			onend,
			set_position: (x, y) => {
				left.next(x);
				top.next(y);
			},
		});
	}, 50);

	let isSelected = memo(
		() => state.selected.value().includes(node.id),
		[state.selected],
	);

	let isMultiSelected = memo(
		() =>
			state.selected.value().length > 1 &&
			state.selected.value().includes(node.id),
		[state.selected],
	);

	let el = dom(
		".draggable.node",
		{
			style,
			selected: isSelected,
			"multi-selected": isMultiSelected,
			...attr,
		},
		...edges,
		...connects,
		...children,
	);

	return el;
};
export let createRegistery = () => {
	let components = {};
	let register = (name, inputs, outputs, render, transform) => {
		let id = name;
		console.log(id);
		if (typeof name == "object") {
			console.log("GOT OBJECT!?");
			inputs = name.inputs;
			outputs = name.outputs;
			render = name.render;
			transform = name.transform;
			id = name.id;
		}
		if (components[id]) console.error("Cant Make duplicates");
		components[id] = {
			inputs,
			outputs,
			render,
			transform,
		};
		list.next(Object.keys(components));
	};

	// or maybe
	// this should be called something like mount
	let mount = (node) => {
		let { render, inputs, outputs, transform } = components[node.type];

		let _inputs = reactive({});
		store.subscribe(BUFFERS.concat([node.id]), (e) => _inputs.next(e));
		let timeout;
		let activated = reactive(false);
		_inputs.subscribe(() => {
			if (timeout) clearTimeout(timeout);
			activated.next(true);
			timeout = setTimeout(() => {
				activated.next(false);
			}, 500);
		});

		if (inputs) {
			// initialize inputs
			let props = store.get(getNodeLocation(node.id).concat(["data"]));
			if (!props) props = {};

			if (typeof inputs == "object") {
				Object.entries(inputs).forEach(([key, value]) => {
					// check if already data
					if (props[key] == undefined) props[key] = value.default;
				});
			}

			store.apply(getNodeLocation(node.id), "set", ["data", props], false);
		}

		let inputParsed = memo(() => {
			let props = store.get(getNodeLocation(node.id).concat(["data"]));
			if (typeof inputs == "object") {
				Object.entries(inputs).forEach(([key, value]) => {
					if (value.collects) props[key] = [];
				});
			}

			// sort inputs first based on edges
			// not sure how this will work...
			let sorted = {};
			let edgesCopy = store.get(["data", "edges"]);
			Object.entries(_inputs.value()).forEach(([key, value]) => {
				let edge = store.get(["edgeMap", key]).find((e) =>
					e.blockId == node.id
				);
				let edgeId;
				if (edge) edgeId = edge.edgeId;
				let position = edgesCopy.findIndex((e) => e.id == edgeId);
				sorted[position + ""] = value;
			});

			Object.values(sorted).forEach((p) => {
				if (!p) return;

				Object.entries(p).forEach(([key, value]) => {
					if (value == undefined) {
						return;
					} else if (typeof inputs == "string" && inputs == "ANY") {
						props[key] = value;
					} else if (inputs[key] != undefined) {
						// TODO: Make these transactions...
						if (inputs[key].collects) props[key].push(value);
						else props[key] = value;
					}
				});
			});

			return props;
		}, [_inputs]);

		// --------------
		// --------------
		// OUTPUTING LOGIC
		// --------------
		// --------------
		let update = reactive(0);
		let updateTimeout;
		let updateBuffers = () => {
			// if (updateTimeout) clearTimeout(updateTimeout);
			// updateTimeout = setTimeout(() => {
			update.next((e) => e + 1);
			// }, 150);
		};

		if (transform) {
			let _outputs = {
				isReactive: true,
				value: () => store.get(EDGEMAP.concat([node.id])),
				subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
			};

			let outputBuffers = memo(
				() =>
					_outputs
						.value()
						.map((e) => e.blockId),
				[_outputs],
			);

			memo(() => {
				if (!outputBuffers.value()) return;
				outputBuffers.value().forEach((id) => {
					let v = transform(inputParsed.value());
					store.apply(["buffers", id], "set", [node.id, v], false);
				});
			}, [outputBuffers, inputParsed, update]);
		}

		if (!render) return;
		else {
			let rendered = render(node, inputParsed, updateBuffers);
			if (Array.isArray(rendered)) {
				return nodeContainer(node, { activated }, rendered);
			} else return rendered;
		}
	};

	let list = reactive(Object.keys(components));
	let getTransformFn = (id) => components[id]?.transform;

	return { register, mount, list, getTransformFn };
};
