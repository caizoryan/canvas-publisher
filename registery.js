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
import { round } from "./components/utils.js";

export let addToSelection = (block, e) => {
	if (e.shiftKey) state.selected.next((e) => [...e, block.id]);
	else state.selected.next([block.id]);
};

export let duplicateBlock = (props) => {
	let block = {};
	Object.assign(block, props);
	block.id = block.id ? block.id : uuid();
	addNode(block);
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

			let block = {};
			block.type = node.type;
			block.x = left.value() + 50;
			block.y = top.value() + 50;
			block.width = width.value();
			block.height = height.value();
			block.color = color.value();
			let d = { ...store.get(getNodeLocation(node.id).concat(["data"])) };
			block.data = d;

			duplicateBlock(block);

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
				left.next(round(x, 50));
				top.next(round(y, 50));
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
			id: node.id,
			title: node.type,
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
	let updateFunctions = [];
	let register = (name, inputs, outputs, render, transform) => {
		let id = name;
		console.log(id);
		if (typeof name == "object") {
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

	let refreshData = () => {
		updateFunctions.forEach((fn) => {
			if (typeof fn == "function") fn();
		});
	};

	// or maybe
	// this should be called something like mount
	let mount = (node) => {
		let { render, inputs, transform } = components[node.type];

		let _inputs = reactive({});
		store.subscribe(
			BUFFERS.concat([node.id]),
			(e) => _inputs.next(e),
		);
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
			// let props = store.get(getNodeLocation(node.id).concat(["data"]));
			// if (!props) props = {};
			if (typeof inputs == "object") {
				Object.entries(inputs).forEach(([key, value]) => {
					if (value.collects) {
						store.tr(getNodeLocation(node.id).concat(["data"]), "set", [
							key,
							[],
						], false);
					}
					// props[key] = [];
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
						store.tr(getNodeLocation(node.id).concat(["data"]), "set", [
							key,
							value,
						], false);
					} else if (inputs[key] != undefined) {
						if (inputs[key].collects) {
							store.tr(
								getNodeLocation(node.id).concat(["data", key]),
								"push",
								value,
								false,
							);
						} // props[key].push(value);
						else {
							store.tr(getNodeLocation(node.id).concat(["data"]), "set", [
								key,
								value,
								false,
							]);
						}
					}
				});
			});

			return store.get(getNodeLocation(node.id).concat(["data"]));
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

		updateFunctions.push(updateBuffers);

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
	let getInputs = (id) => components[id]?.inputs;

	return { register, mount, list, getTransformFn, getInputs, refreshData };
};
