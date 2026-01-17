// Reactive interface:
// ~> (to plug into the store)
import { Color, connectors, CSSTransform, resizers } from "./block.js";
import { memo, reactive } from "./chowk.js";
import { dom } from "./dom.js";
import { drag } from "./drag.js";
import {
	BUFFERS,
	EDGEMAP,
	getNodeLocation,
	store,
	subscribeToId,
} from "./state.js";

// ~~~~~~~~~~~~~~~~~~~
let R = (location, id) => (key) => ({
	isReactive: true,
	value: () => store.get(location.concat([key])),
	next: (v) => store.tr(location, "set", [key, v], false),
	subscribe: (fn) => subscribeToId(id, [key], fn),
});

export const renderCanvas = (node) => {
	let r = R(getNodeLocation(node.id), node.id);

	let left = r("x");
	let top = r("y");
	let color = r("color");
	let height = r("height");
	let width = r("width");

	let inputs = reactive({});

	// from for this node
	store.subscribe(BUFFERS.concat([node.id]), (e) => inputs.next(e));

	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);

	let onstart = (e) => {
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

	let canvas = dom(["canvas", { width: width, height: height }]);
	let el = dom(".draggable.node", { style }, ...edges, canvas, ...connects);

	let ctx = canvas.getContext("2d");

	memo(() => {
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, width.value() - 10, height.value() - 10);

		ctx.strokeStyle = "black";
		ctx.strokeRect(10, 10, 140, 160);

		if (inputs.value()) {
			Object.values(inputs.value()).forEach((d) => {
				if (!d) return;
				if (d.draw) d.draw(ctx);
			});
		}
	}, [width, height, inputs]);

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

	return el;
};

export const renderCircle = (node) => {
	let r = R(getNodeLocation(node.id), node.id);

	let left = r("x");
	let top = r("y");
	let color = r("color");
	let height = r("height");
	let width = r("width");

	// handling inputs and subscriptions
	let inputs = reactive({});

	// for outputting the fn
	let outputs = {
		isReactive: true,
		value: () => store.get(EDGEMAP.concat([node.id])),
		subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
	};

	let outputBuffer = memo(() => outputs.value().map((e) => e.blockId), [
		outputs,
	]);
	// let removeBuffer = (id) => outputBuffer.next(e => e.filter(f => f!=id))

	// subscribe to edges
	store.subscribe(EDGEMAP.concat([node.id]), (e) => {
		console.log("Circle Outpus", e);
	});

	store.subscribe(BUFFERS.concat([node.id]), (e) => {
		console.log("Circle Input", e);
		inputs.next(e);
	});

	let props = {
		x: 150,
		y: 150,
	};

	inputs.subscribe((v) => {
		Object.values(v).forEach((p) => {
			console.log(p);
			if (!p) return;
			Object.entries(p).forEach(([key, value]) => {
				if (props[key]) props[key] = value;
			});
		});
		update.next((e) => e + 1);
	});

	let drawCircleFn = () => (ctx) => {
		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		ctx.beginPath();
		ctx.arc(props.x, props.y, size.value(), 0, 2 * Math.PI);
		ctx.stroke();
	};

	let size = reactive(50);
	let update = reactive(0);

	let slider = ["input", {
		type: "range",
		min: 50,
		max: 450,
		oninput: (e) => {
			size.next(e.target.value);
		},
	}];

	let drawCircle = (ctx) => {
		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		ctx.beginPath();
		ctx.arc(95, 50, size.value(), 0, 2 * Math.PI);
		ctx.stroke();
	};

	let interval;
	memo(() => {
		if (!outputBuffer.value()) return;
		outputBuffer.value().forEach((id) => {
			store.apply(["buffers", id], "set", [node.id, {
				draw: drawCircleFn(500),
			}], false);
		});
	}, [outputBuffer, size, update]);

	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);

	let onstart = (e) => {
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

	let canvas = dom(["canvas", { width: width, height: height }]);
	let el = dom(
		".draggable.node",
		{ style },
		node.id,
		slider,
		...edges,
		canvas,
		...connects,
	);

	let ctx = canvas.getContext("2d");

	memo(() => {
		ctx.clearRect(0, 0, width.value(), height.value());
		drawCircleFn()(ctx);
	}, [width, height, size, inputs]);

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

	return el;
};

export const renderNumberPropFn = (key) => (node) => {
	let r = R(getNodeLocation(node.id), node.id);

	let left = r("x");
	let top = r("y");
	let color = r("color");
	let height = r("height");
	let width = r("width");

	// for outputting the fn
	let outputs = {
		isReactive: true,
		value: () => store.get(EDGEMAP.concat([node.id])),
		subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
	};

	let outputBuffer = memo(() => outputs.value().map((e) => e.blockId), [
		outputs,
	]);

	let size = reactive(50);
	let slider = ["input", {
		type: "range",
		min: 50,
		max: 450,
		oninput: (e) => {
			size.next(e.target.value);
		},
	}];

	memo(() => {
		if (!outputBuffer.value()) return;
		let v = () => {
			let obj = {};
			obj[key] = size.value();
			return obj;
		};

		outputBuffer.value().forEach((id) => {
			store.apply(["buffers", id], "set", [node.id, v()], false);
		});
	}, [outputBuffer, size]);

	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);

	let onstart = (e) => {
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

	let el = dom(
		".draggable.node",
		{ style },
		node.id,
		slider,
		key + ": ",
		size,
		...edges,
		...connects,
	);

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

	return el;
};
