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
import { button } from "../block.js";

export let objectPlexer = (node, inputs, updateOut) => {
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("key");

	let cursor = dom(["input.object", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			updateOut();
		},
		value: key,
	}]);

	return [["span", "{ "], cursor, ["span", " }"]];
};

export let objectExtractor = (node, inputs, updateOut) => {
	// Make an R out of key
	let r = dataR(getNodeLocation(node.id), node.id, "_data");
	let key = r("key");

	let cursor = dom(["input.object", {
		type: "text",
		style: "border-bottom: 1px solid black",
		oninput: (e) => {
			key.next(e.target.value.trim());
			updateOut();
		},
		value: key,
	}]);

	return [["span", "{ "], cursor, ["span", " }"]];
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
	// let props = getProps(node.id);

	let calculate = () => {
		let props = getProps(node.id);
		let added = {};
		props.value.forEach((obj) => {
			if (!obj) return;
			Object.entries(obj).forEach(
				([key, value]) => {
					if (added[key] && typeof added[key] == "number") {
						added[key] += value;
					} else added[key] = value;
				},
			);
		});
		return added.value ? added.value : 0;
	};

	let val = reactive(calculate());
	update.subscribe(() => {
		val.next(calculate().toFixed(2));
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
			console.log("NUM", num);
			if (typeof num == "number" && !isNaN(num)) {
				console.log("setting", num);
				key.next(num);
			}
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
		updateOut();
	});

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
	`, [x, y]);
	let cursor = dom([
		".psuedo-cursor.flex-center",
		{ style: stylememo },
	]);

	let snapSize = reactive(20);
	let fullSizeGrid = [".full-size-grid", {
		style: memo(
			() => `background-size: ${snapSize.value()}px ${snapSize.value()}px`,
			[
				snapSize,
			],
		),
	}];

	let snap = ["input", {
		style: "position: absolute;left: 6em;bottom: 1em;",
		type: "range",
		min: 1,
		max: 100,
		step: .5,
		oninput: (e) => snapSize.next(parseFloat(e.target.value)),
	}];

	let magic = ["button", {
		style: "position: absolute;left: 1em;bottom: 1em;",
		onclick: () => {
			let e = document.querySelector("#" + node.id);
			if (e) {
				e.style.backgroundColor = "#8881";

				if (e.style.pointerEvents == "none") e.style.pointerEvents = "auto";
				else e.style.pointerEvents = "none";
			}
		},
	}, "magic"];

	setTimeout(() => {
		let set_left = (v) => x.next(round(v, snapSize.value()));
		let set_top = (v) => y.next(round(v, snapSize.value()));

		drag(cursor, { set_left, set_top });
	}, 100);

	return [fullSizeGrid, cursor, snap, magic];
};

let line = (node, ins, updateOut) => {
	let r = dataR(getNodeLocation(node.id), node.id);
	let points = r("points");
	let start = memo(() => points.value() ? points.value()[0] : { x: 0, y: 0 }, [
		points,
	]);

	let end = memo(() => points.value() ? points.value()[1] : { x: 0, y: 0 }, [
		points,
	]);

	points.subscribe(() => updateOut());

	let startStyle = memo(() => {
		let s = start.value();
		console.log(s);
		if (!s) s = { x: 0, y: 0 };
		return `
		left: ${s.x}px;
		top:  ${s.y}px;
	`;
	}, [start]);

	let startCursor = dom([
		".psuedo-cursor.flex-center",
		{ style: startStyle },
	]);

	let endStyle = memo(() => {
		let s = end.value();
		console.log(s);
		if (!s) s = { x: 10, y: 50 };
		return `
		left: ${s.x}px;
		top:  ${s.y}px;
	`;
	}, [end]);

	let endCursor = dom([
		".psuedo-cursor.flex-center",
		{ style: endStyle },
	]);

	setTimeout(() => {
		let set_start_position = (x, y) => {
			points.next([{ x, y }, points.value()[1]]);
			console.log(points.value());
		};

		let set_end_position = (x, y) => {
			points.next([points.value()[0], { x, y }]);
			console.log(points.value());
		};

		drag(startCursor, { set_position: set_start_position });
		drag(endCursor, { set_position: set_end_position });
	}, 100);

	return [startCursor, endCursor];
};

let grid2D = (node, ins, updateOut) => {
	let props = getProps(node.id);
	let r = dataR(getNodeLocation(node.id), node.id);
	let _r = R(getNodeLocation(node.id), node.id);
	let width = _r("width");
	let height = _r("height");
	let columns = r("columns");
	let rows = r("rows");
	let coord = r("coord");
	let x = r("x");
	let y = r("y");

	coord.subscribe((c) => {
		let xDiff = width.value() / columns.value();
		let yDiff = height.value() / rows.value();
		x.next(c[0] * xDiff);
		y.next(c[1] * yDiff);
		updateOut();
	});

	// for c = 10, r = 10, coord = [5,5] will be center
	// x.subscribe(() => updateOut());

	// let stylememo = memo(() => `
	// 	left: ${x.value()}px;
	// 	top:  ${y.value()}px;
	// `, [x]);
	//
	// let cursor = dom([
	// 	".psuedo-cursor.flex-center",
	// 	{ style: stylememo },
	// ]);

	let marker = (position, x, y) => [".marker", {
		onclick: () => coord.next(position),
		active: memo(
			() => coord.value()[0] == position[0] && coord.value()[1] == position[1],
			[coord],
		),
		style: `left: ${x}px; top: ${y}px`,
	}, "x"];

	let grid = memo(() => {
		let xDiff = width.value() / columns.value();
		let yDiff = height.value() / rows.value();
		let markers = [];
		for (let y = 0; y < rows.value(); y++) {
			for (let x = 0; x < columns.value(); x++) {
				markers.push(marker([x, y], xDiff * x, yDiff * y));
			}
		}

		return [".markers", ...markers];
		// will take rows and cols and divide
		// width and height with it
		// then will constuct spots to put things
		// everytime col, row is changed redo
	}, [rows, columns, width, height]);

	setTimeout(() => {
		// let set_left = (v) => x.next(round(v, 20));
		// let set_top = (v) => y.next(round(v, 20));
		//
		// drag(cursor, { set_left, set_top });
	}, 100);

	return [grid];
};

export const round = (n, r) => Math.ceil(n / r) * r;
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

	let cursor = dom(["input.variable", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
		value: key,
	}]);

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
		outputBuffers.next(
			store.get(EDGEMAP.concat([node.id]))
				.map((e) => e.blockId)
				.map(follow),
		);

		let variables = store.get(["variables"]);

		// if there is already a var from this node and its key is not cur, remove it
		let found = Object.entries(variables)
			.find(([k, value]) => value?.source == node.id && k != key.value());

		if (found) {
			store.tr(["variables"], "set", [found[0], undefined]);
		}

		store.tr(["variables"], "set", [key.value(), {
			function: compileFunction(outputBuffers.value()),
			source: node.id,
		}]);
	};

	inputs.subscribe(() => setTimeout(() => update(), 45));

	let _outputs = {
		isReactive: true,
		value: () => store.get(EDGEMAP.concat([node.id])),
		subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
	};

	let follow = (nodeId) => {
		let edges = store.get(EDGEMAP.concat([nodeId]));
		let allEdges = store.get(EDGEMAP);
		if (!edges) return { id: nodeId, out: [] };
		// .map((e) => e.blockId);
		let data = store.get(getNodeLocation(nodeId).concat(["data"]));
		let _data = store.get(getNodeLocation(nodeId).concat(["_data"]));
		let type = store.get(getNodeLocation(nodeId).concat(["type"]));
		let transform = registery.getTransformFn(type);
		let inputs = registery.getInputs(type);

		let outputsTo = edges
			.map((e) => e.blockId)
			.map((e) => follow(e));

		return { id: nodeId, out: outputsTo, _data, data, type, transform, inputs };
	};

	let outputBuffers = reactive([]);
	_outputs.subscribe((v) => {
		setTimeout(() => {
			outputBuffers.next(
				v
					.map((e) => e.blockId)
					.map(follow),
			);
		}, 25);
	});

	let applyData = (node, data, newData, inputs) => {
		let props = data;
		if (typeof inputs == "object") {
			Object.entries(inputs).forEach(([key, value]) => {
				// TODO: This is where the issue was
				// it expected to get all inputs together not sequentially...
				// Essentially have to track all inputs, so have to create
				// a virtual buffer system also.
				// BUt this is good, cuz I can write this out and then replace the main one
				// with this nicer simpler impl
				if (value.collects) props[key] = [];
			});
		}

		// sort inputs first based on edges
		// not sure how this will work...
		let sorted = {};
		let edgesCopy = store.get(["data", "edges"]);
		Object.entries(newData).forEach(([key, value]) => {
			let edge = store.get(EDGEMAP.concat([key])).find((e) =>
				e.blockId == node.id
			);

			let edgeId;
			if (edge) edgeId = edge.edgeId;
			let position = edgesCopy.findIndex((e) => e.id == edgeId);
			sorted[position + ""] = value;
		});

		if (inputs == "COLLECTS") {
			props.value = Object.values(sorted);
		} else {
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
		}

		return props;
	};

	let compileFunction = (buffers) => {
		let executeAndReturn = (props) => {
			let returnNode;
			let virtualNodes = {};
			let virtualBuffers = {};
			let execute = (e, input = {}) => {
				let node = virtualNodes[e.id];
				let buffer = virtualBuffers[e.id];
				Object.assign(buffer, input);

				applyData(node, node.data, buffer, node.inputs);

				e.out.forEach((f) => {
					execute(f, { [e.id]: node.transform(node.data, node._data) });
				});
			};

			let registerVirtual = (e) => {
				if (!virtualNodes[e.id]) {
					if (e.type == "return" && !returnNode) {
						returnNode = e.id;
					}

					virtualNodes[e.id] = {
						id: e.id,
						data: { ...e.data },
						transform: e.transform,
						inputs: e.inputs,
					};

					if (e._data) {
						virtualNodes[e.id]._data = { ...e._data };
					}

					virtualBuffers[e.id] = {};
				}

				e.out.forEach((f) => {
					registerVirtual(f);
				});
			};

			buffers.forEach((e) => {
				registerVirtual(e);
			});

			buffers.forEach((e) => {
				execute(e, { [node.id]: props });
			});

			// if (returnNode) console.log("Return is there", virtualNodes[returnNode]);
			if (returnNode) return virtualNodes[returnNode].data;
		};

		return executeAndReturn;
	};

	let cursor = dom(["input.function.definition", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
		value: key,
	}]);

	setTimeout(() => {
		update();
	}, 50);

	return [
		button("compile", () => {
			update();
		}),
		cursor,
	];
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

	let cursor = dom(["input.variable", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
		value: key,
	}]);

	return [cursor];
	// let R = dataR()
	// will basically subscribe to variable manually
	// update all the outputs
};

let applyFunction = (node, inputs, updateOut) => {
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("name");
	let _function = r("function");

	let sub = store.subscribe(["variables", key.value()], (e) => {
		if (e && e.function) _function.next(e.function);
	});

	_function.subscribe((v) => {
		updateOut();
	});

	// read the value, when value re run ...

	let update = () => {
		sub();
		sub = store.subscribe(["variables", key.value()], (e) => {
			if (e) _function.next(e);
		});
		let _value = store.get(["variables", key.value()]);
		if (_value) _function.next(_value);
	};

	let cursor = dom(["input.function.application", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			update();
		},
		value: key,
	}]);

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

export let ApplyFunction = {
	id: "apply-function",
	render: applyFunction,
	inputs: "ANY",
	outputs: {},
	transform: (props) => {
		if (!props?.function) return {};
		else if (typeof props.function == "function") {
			let out = { ...props.function(props) };
			return out;
		} else if (typeof props.function?.function == "function") {
			let out = { ...props.function.function(props) };
			return out;
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

export let CollectObjects = {
	id: "ObjectCollect",
	render: () => [dom(["span", " [ {...} ] "])],
	inputs: "COLLECTS",
	outputs: {},
	transform: (props) => {
		if (!props) return {};
		else if (typeof props == "object") {
			return { ...props };
		} else return {};
	},
};

export let LogObject = {
	id: "LOG",
	render: (node, inputs) => {
		const props = reactive("");
		inputs.subscribe((v) => {
			props.next(JSON.stringify(getProps(node.id), null, 2));
		});

		let clear = () => {
			store.tr(getNodeLocation(node.id), "set", ["data", {}]);
			props.next("{}");
		};

		return [
			button("clear", clear),
			dom(["pre", props]),
		];
	},
	inputs: "ANY",
	outputs: {},
	transform: (props) => {
		return {};
	},
};

export let NamedObject = {
	id: "NamedObject",
	render: (node, ins, updateOut) => {
		let r = dataR(getNodeLocation(node.id), node.id);
		let key = r("key");
		return [dom([".dawg", ["input.object", {
			type: "text",
			value: key,
			oninput: (e) => {
				key.next(e.target.value.trim());
				updateOut();
			},
		}], ["span", " {...} "]])];
	},
	inputs: "ANY",
	outputs: {},
	transform: (props) => {
		if (!props || !props?.key) return {};
		else if (typeof props == "object") {
			return { [props.key]: { ...props } };
		} else return {};
	},
};

export let ReturnObject = {
	id: "return",
	render: () => [dom(["span", " RETURN {...} "])],
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
		inputs: "COLLECTS",
		outputs: {},
		transform: (props) => {
			let added = {};
			props.value.forEach((obj) => {
				if (!obj) return;
				Object.entries(obj).forEach(
					([key, value]) => {
						if (added[key] && typeof added[key] == "number") {
							added[key] += value;
						} else added[key] = value;
					},
				);
			});
			return added;
			// ({
			// 		value: props.value.reduce((acc, v) => acc += v, 0),
			// 	}),
		},
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
		inputs: { value: V.number(1).collect(), start: V.number(1) },
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

export let String = {
	id: "string",
	inputs: { value: V.string("") },
	outputs: {},
	render: (node, i, updateOut) => {
		let r = dataR(getNodeLocation(node.id), node.id);
		let key = r("value");

		let text = dom(["textarea", {
			type: "text",
			oninput: (e) => {
				key.next(e.target.value.trim());
				updateOut();
			},
			value: key,
		}, key]);

		return [dom(["span", "STRING"]), text];
	},
	transform: (props) => props,
};

export let Number = {
	id: "number",
	inputs: { value: V.number(1) },
	outputs: {},
	render: (node, i, updateOut) => {
		let r = dataR(getNodeLocation(node.id), node.id);
		let key = r("value");

		key.subscribe((v) => console.log("NUmber changed", v));
		key.subscribe((v) => text.value = v);

		let text = dom(["input.number", {
			type: "number",
			oninput: (e) => {
				let v = parseFloat(e.target.value);
				if (!isNaN(v) && typeof v == "number") key.next(v);
				updateOut();
			},
			value: key,
		}]);

		return [text];
	},
	transform: (props) => props,
};

export let LineEditor = {
	id: "lineEditor",
	inputs: {
		points: V.any([{ x: 0, y: 0 }, { x: 100, y: 100 }]),
	},
	outputs: {},
	render: line,
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

export let Grid = {
	id: "grid",
	inputs: {
		x: V.number(10),
		y: V.number(10),
		columns: V.number(10),
		rows: V.number(10),
		coord: V.array([2, 2]),
	},
	outputs: {},
	render: grid2D,
	transform: (props) => {
		return { x: props.x, y: props.y };
	},
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
		if (!props) return {};
		const o = {};
		o[props.key] = props.value;
		return o;
	},
};

export const ObjectExtracter = {
	id: "ObjectGet",
	render: objectExtractor,
	inputs: "ANY",
	outputs: {},
	transform: (props, internal) => {
		if (!props || !internal || typeof internal.key != "string") return {};
		const o = {};
		o.value = props[internal.key];
		return o;
	},
};
