import { dataR, getProps, R } from "./index.js";
import {
	EDGEMAP,
	getNodeLocation,
	NODEAT,
	registery,
	store,
} from "../state.js";
import { dom } from "../dom.js";
import { memo, reactive } from "../chowk.js";
import { drag } from "../drag.js";
import { V } from "../schema.js";

export let objectPlexer = (node, inputs, updateOut) => {
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("key");

	let cursor = dom(["textarea", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			updateOut();
		},
	}, key]);

	return [cursor];
};

export let colorSliders = (node, inputs, updateOut) => {
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id);
	let c = r("c");
	let m = r("m");
	let y = r("y");
	let k = r("k");

	let colorSlider = (v) => {
		return ["input.color", {
			type: "range",
			min: 0,
			max: 100,
			step: 1,
			value: memo(() => v.value(), [inputs]),
			oninput: (e) => {
				v.next(parseFloat(e.target.value));
				updateOut();
			},
		}];
	};

	function cmykToRgb(c, m, y, k) {
		const r = Math.round(255 * (1 - c) * (1 - k));
		const g = Math.round(255 * (1 - m) * (1 - k));
		const b = Math.round(255 * (1 - y) * (1 - k));

		return { r, g, b };
	}

	let box = [".color-box", {
		style: memo(() => {
			let { r, g, b } = cmykToRgb(
				c.value() / 100,
				m.value() / 100,
				y.value() / 100,
				k.value() / 100,
			);

			return `background-color: rgb(${r}, ${g}, ${b});`;
		}, [c, m, y, k]),
	}];

	return [
		colorSlider(c),
		colorSlider(m),
		colorSlider(y),
		colorSlider(k),
		box,
	];
};

export let add = (node, inputs, updateOut) => {
	// Make an R out of key
	let update = inputs;
	let props = getProps(node.id);
	let val = reactive(props.value.reduce((acc, v) => acc += v, 0));

	update.subscribe(() => {
		props = getProps(node.id);
		val.next(
			props.value.reduce((acc, v) => acc += v, 0)
				.toFixed(2),
		);
	});

	let cursor = dom(["code", "+ ", ["span", val]]);

	return [cursor];
};

export let sub = (node, inputs, updateOut) => {
	// Make an R out of key
	let update = inputs;
	let props = getProps(node.id);
	let val = reactive(
		props.value.reduce((acc, v, i) => i == 0 ? acc = v : acc -= v, 0),
	);

	update.subscribe(() => {
		props = getProps(node.id);
		val.next(
			props.value.reduce((acc, v, i) => i == 0 ? acc = v : acc -= v, 0)
				.toFixed(2),
		);
	});

	let cursor = dom(["code", "+ ", ["span", val]]);

	return [cursor];
};

export let mul = (node, inputs, updateOut) => {
	// Make an R out of key
	let update = inputs;
	let props = getProps(node.id);
	let val = reactive(
		props.value.reduce((acc, v, i) => i == 0 ? acc = v : acc -= v, 0),
	);

	update.subscribe(() => {
		props = getProps(node.id);
		val.next(
			props.value.reduce((acc, v, i) => i == 0 ? acc = v : acc -= v, 0)
				.toFixed(2),
		);
	});

	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("start");

	let input = dom(["input", {
		type: "number",
		value: key,
		oninput: (e) => {
			let num = parseFloat(e.target.value.trim());
			if (typeof num == "number") key.next(num);
			updateOut();
		},
	}, key]);

	let cursor = dom(["code", input, " * ", ["span", val]]);

	return [cursor];
};

let sliderAxis = (axis = "horizontal") => (node, ins, updateOut) => {
	let props = getProps(node.id);
	let value = props.value ? props.value : 1;

	ins.subscribe((v) => {
		props = getProps(node.id);
		if (props.value == undefined) return;
		x.next(props.value);
	});

	let x = reactive(value);
	x.subscribe((v) => {
		store.apply(getNodeLocation(node.id).concat(["data"]), "set", [
			"value",
			v,
		], false);
		updateOut();
	});

	let stylememo = memo(() => `
		left: ${axis == "horizontal" ? x.value() : -8}px;
		top:  ${axis == "vertical" ? x.value() : -8}px;
	`, [x]);
	let cursor = dom([
		".psuedo-cursor.flex-center",
		{ style: stylememo },
	]);

	setTimeout(() => {
		let set_left = (v) => axis == "horizontal" ? x.next(v) : null;
		let set_top = (v) => axis == "vertical" ? x.next(v) : null;

		drag(cursor, { set_left, set_top });
	}, 100);

	return [cursor];
};

let slider2D = (node, ins, updateOut) => {
	let props = getProps(node.id);
	let r = dataR(getNodeLocation(node.id), node.id);
	let x = r("x");
	let y = r("y");
	x.subscribe(() => updateOut());

	let stylememo = memo(() => `
		left: ${x.value()}px;
		top:  ${y.value()}px;
	`, [x]);
	let cursor = dom([
		".psuedo-cursor.flex-center",
		{ style: stylememo },
	]);

	setTimeout(() => {
		let set_left = (v) => x.next(v);
		let set_top = (v) => y.next(v);

		drag(cursor, { set_left, set_top });
	}, 100);

	return [cursor];
};

let declareVariable = (node, inputs) => {
	// will take a value as input
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("name");

	let update = () => {
		let variables = store.get(["variables"]);
		// if there is already a var from this node and its key is not cur, remove it
		let found = Object.entries(variables)
			.find(([k, value]) => value?.source == node.id && k != key.value());

		if (found) {
			store.tr(["variables"], "set", [found[0], undefined]);
		}

		let value = store.get(getNodeLocation(node.id).concat(["data"]));
		store.tr(["variables"], "set", [key.value(), {
			value,
			source: node.id,
		}]);
	};

	inputs.subscribe(update);

	let cursor = dom(["textarea", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
	}, key]);

	return [cursor];
	// will have a name
	// will save name to node map vibes...
};

let Function = (node, inputs) => {
	// will take a value as input
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("name");

	let update = () => {
		let variables = store.get(["variables"]);
		// if there is already a var from this node and its key is not cur, remove it
		let found = Object.entries(variables)
			.find(([k, value]) => value?.source == node.id && k != key.value());

		if (found) {
			store.tr(["variables"], "set", [found[0], undefined]);
		}

		let value = store.get(getNodeLocation(node.id).concat(["data"]));
		store.tr(["variables"], "set", [key.value(), {
			value,
			source: node.id,
		}]);
	};

	inputs.subscribe(update);

	let _outputs = {
		isReactive: true,
		value: () => store.get(EDGEMAP.concat([node.id])),
		subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
	};

	let follow = (nodeId) => {
		let edges = store.get(EDGEMAP.concat([nodeId]));
		if (!edges) return { block: nodeId, out: [] };
		// .map((e) => e.blockId);
		let data = store.get(getNodeLocation(nodeId).concat(["data"]));
		let type = store.get(getNodeLocation(nodeId).concat(["type"]));
		let transform = registery.getTransformFn(type);

		let outputsTo = edges
			.map((e) => e.blockId)
			.map((e) => follow(e));

		return { block: nodeId, out: outputsTo, data, type, transform };
	};

	let outputBuffers = memo(
		() =>
			_outputs
				.value()
				.map((e) => e.blockId)
				.map(follow),
		[_outputs],
	);

	let applyData = (node, data, newData, inputs) => {
		let props = data;
		if (typeof inputs == "object") {
			Object.entries(inputs).forEach(([key, value]) => {
				if (value.collects) props[key] = [];
			});
		}

		// sort inputs first based on edges
		// not sure how this will work...
		let sorted = {};
		let edgesCopy = store.get(["data", "edges"]);
		Object.entries(newData).forEach(([key, value]) => {
			let edge = store.get(["edgeMap", key]).find((e) => e.blockId == node.id);
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
	};

	outputBuffers.subscribe((f) => {
		console.log("Outputs to, ", f);
		let printFn = (e) => {
			console.log("Daddy: ", e.type, e.transform);
			if (e.out?.length > 0) console.log("Children: ");
			e.out.forEach((f) => {
				printFn(f);
			});
		};

		f.forEach((e) => {
			printFn(e);
		});
		// Essentially I have to make a virtual node system
		// perform the applications
		// and at the end return the data from first return node
		// return node will be same as object node, just with a return tag
		// following -> save data and fn and have a next,
		// result of one transform goes to the data of next application
		//
		// follow till you get to a return block
	});

	// memo(() => {
	// 	if (!outputBuffers.value()) return;
	// 	outputBuffers.value().forEach((id) => {
	// 		let v = transform(inputParsed.value());
	// 		store.apply(["buffers", id], "set", [node.id, v], false);
	// 	});
	// }, [outputBuffers]);

	let cursor = dom(["textarea", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
	}, key]);

	return [cursor];
	// will have a name
	// will save name to node map vibes...
};

let recieverVariable = (node, inputs, updateOut) => {
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("name");
	let value = r("value");

	let sub = store.subscribe(["variables", key.value()], (e) => {
		if (e) value.next(e);
	});

	value.subscribe((v) => {
		updateOut();
	});

	let update = () => {
		sub();
		sub = store.subscribe(["variables", key.value()], (e) => {
			if (e) value.next(e);
		});
		let _value = store.get(["variables", key.value()]);
		if (_value) value.next(_value);
	};

	let cursor = dom(["textarea", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
	}, key]);

	return [cursor];
	// let R = dataR()
	// will basically subscribe to variable manually
	// update all the outputs
};

export let CreateVariable = {
	id: "create-variable",
	render: declareVariable,
	inputs: "ANY",
	outputs: {},
	transform: (props) => ({}),
};

export let CreateFunction = {
	id: "create-function",
	render: Function,
	inputs: {},
	outputs: {},
	transform: (props) => {
		console.log(props);
		return {};
	},
};

export let ReadVariable = {
	id: "read-variable",
	render: recieverVariable,
	inputs: { value: V.any({}) },
	outputs: {},
	transform: (props) => {
		if (!props?.value?.value) return {};
		else if (typeof props.value.value == "object") {
			return { ...props.value.value };
		} else return {};
	},
};

export let CompileObject = {
	id: "ObjectMerge",
	render: () => [dom(["span", " {...} "])],
	inputs: "ANY",
	outputs: {},
	transform: (props) => {
		if (!props) return {};
		else if (typeof props == "object") {
			return { ...props };
		} else return {};
	},
};

export let MathComps = {
	add: {
		id: "add",
		render: add,
		inputs: { value: V.number(0).collect() },
		outputs: {},
		transform: (props) => ({
			value: props.value.reduce((acc, v) => acc += v, 0),
		}),
	},

	sub: {
		id: "sub",
		render: sub,
		inputs: { value: V.number(0).collect() },
		outputs: {},
		transform: (props) => ({
			value: props.value.reduce(
				(acc, v, i) => i == 0 ? acc = v : acc -= v,
				0,
			),
		}),
	},

	mul: {
		id: "mul",
		render: mul,
		inputs: { value: V.number(0).collect(), start: V.number(1) },
		outputs: {},
		transform: (props) => ({
			value: props.value.reduce(
				(acc, v) => acc *= v,
				props.start,
			),
		}),
	},
};

export let Slider = {
	id: "slider",
	inputs: { value: V.number(10) },
	outpus: {},
	render: sliderAxis(),
	transform: (props) => props,
};

export let Slider2D = {
	id: "slider2D",
	inputs: {
		x: V.number(10),
		y: V.number(10),
	},
	outputs: {},
	render: slider2D,
	transform: (props) => props,
};

export const ObjectLabeller = {
	id: "Object",
	render: objectPlexer,
	inputs: {
		key: V.string("x"),
		value: V.number(0),
	},
	outputs: {},
	transform: (props) => {
		const o = {};
		o[props.key] = props.value;
		return o;
	},
};
