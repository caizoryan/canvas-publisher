// will basically allow me to register components and then
// when rendering, it will send each node to registery
// registery will match the type to its components
// and send back an element.
import { addToSelection, R } from "./canvas.js";
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

let nodeContainer = (node, children) => {
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
		store.startBatch();

		left.next(left.value());
		top.next(top.value());
		width.next(width.value());
		height.next(height.value());

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

	let el = dom(
		".draggable.node",
		{ style },
		...edges,
		...connects,
		...children,
	);

	return el;
};
export let createRegistery = () => {
	let components = {};

	let register = (name, inputs, outputs, renderer, transformer) => {
		if (components[name]) console.error("Cant Make duplicates");
		components[name] = {
			inputs,
			outputs,
			renderer,
			transformer,
		};
	};

	// or maybe
	// this should be called something like mount
	let mount = (node) => {
		let { renderer, inputs, outputs, transformer } = components[node.type];

		let _inputs = reactive({});
		store.subscribe(BUFFERS.concat([node.id]), (e) => _inputs.next(e));

		if (inputs) {
			// initialize inputs
			let props = store.get(getNodeLocation(node.id).concat(["data"]));
			if (!props) props = {};

			Object.entries(inputs).forEach(([key, value]) => {
				// check if already data
				if (props[key] == undefined) props[key] = value.default;
			});

			store.apply(getNodeLocation(node.id), "set", ["data", props], false);
		}

		let inputParsed = memo(() => {
			let props = store.get(getNodeLocation(node.id).concat(["data"]));
			Object.entries(inputs).forEach(([key, value]) => {
				if (value.collects) props[key] = [];
			});

			Object.values(_inputs.value()).forEach((p) => {
				if (!p) return;
				Object.entries(p).forEach(([key, value]) => {
					if (value == undefined) {
						return;
					} else if (inputs[key] != undefined) {
						// TODO: Make these transactions...
						if (inputs[key].collects) props[key].push(value);
						else props[key] = value;
					}
				});
			});

			// console.log("FINAL", props);
			return props;
		}, [_inputs]);

		let update = reactive(0);
		let updateBuffers = () => update.next((e) => e + 1);

		if (transformer) {
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
					let v = transformer(inputParsed.value());
					store.apply(["buffers", id], "set", [node.id, v], false);
				});
			}, [outputBuffers, inputParsed, update]);
		}

		if (!renderer) return;
		// can also do some additional stuff like making them draggable and attaching connection points, etc
		// for inputs and outputs, the renderers are responsible to query and subscribe to the stores for their data.
		// or should the registery handle it? since it is handling the drag and stuff.
		// maybe can do that later...
		//
		else {
			let rendered = renderer(node, inputParsed, updateBuffers);
			if (Array.isArray(rendered)) return nodeContainer(node, rendered);
			else return rendered;
		}
	};

	return { register, mount: mount };
};
