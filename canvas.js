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
	state,
	store,
	subscribeToId,
} from "./state.js";

import { blobStream } from "./blob-stream.js";
import { PDFDocument } from "./pdfkit.standalone.js";
import * as PDFJS from "https://esm.sh/pdfjs-dist";
import * as PDFWorker from "https://esm.sh/pdfjs-dist/build/pdf.worker.min";

let queued = {};
try {
	PDFJS.GlobalWorkerOptions.workerSrc = PDFWorker;
	console.log("TRIED");
} catch (e) {
	window.pdfjsWorker = PDFWorker;
	console.log("CAUGHT");
}

let addToSelection = (block, e) => {
	console.log("Changing?", [block.id]);
	if (e.shiftKey) state.selected.next((e) => [...e, block.id]);
	else state.selected.next([block.id]);
};

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

	let pageWidth = 612;
	let pageHeight = 792;
	let connects = connectors(node, left, top, width, height);

	let canvas = dom(["canvas", {
		width: width.value(),
		height: height.value(),
	}]);

	let el = dom(".draggable.node", { style }, ...edges, canvas, ...connects);

	let ctx = canvas.getContext("2d");

	function loadAndRender(url) {
		let start = new Date();
		var loadingTask = PDFJS.getDocument(url);
		loadingTask.promise.then(
			(pdf) => renderPDF(pdf, start),
			(reason) => console.error(reason),
		);
	}

	let renderPDF = (pdf, start) => {
		let end = new Date();
		let ms = end.valueOf() - start.valueOf();
		console.log("PDF loaded in", ms);

		// Fetch the first page
		let pageNumber = 1;
		pdf.getPage(pageNumber).then(function(page) {
			console.log("Page loaded");
			let scale = 1;
			let viewport = page.getViewport({ scale: scale });

			canvas.height = viewport.height;
			canvas.width = viewport.width;
			// Render PDF page into canvas context
			let renderContext = { canvasContext: ctx, viewport: viewport };
			if (queued[node.id]) {
				queued[node.id].cancel();
				queued[node.id] = undefined;
			}

			let renderTask = page.render(renderContext);
			queued[node.id] = renderTask;
			// queued = renderTask

			renderTask.promise.then(function() {
				queued[node.id] = undefined;
				// console.log('Page rendered');
			});
		});
	};

	let draw = (drawables) => {
		let fns = {
			"Circle": drawCircleDocFn,
		};
		if (drawables.length == 0) return;
		const doc = new PDFDocument({
			layout: "landscape",
			size: [pageWidth, pageHeight],
		});
		let stream = doc.pipe(blobStream());
		drawables.forEach((fn) => {
			if (!fn) return;
			typeof fns[fn.draw[0]] == "function"
				? fns[fn.draw[0]](fn.draw[1])(doc)
				: console.log("ERROR: Neither a fn nor a key");
		});

		doc.end();
		stream.on(
			"finish",
			() => loadAndRender(stream.toBlobURL("application/pdf")),
		);
	};

	// wrap this in a RAF
	let next = false;
	function RAFDraw() {
		if (next) {
			// sort these into drawables and properties vibes (props can be width/height...)
			if (inputs.value()) draw(Object.values(inputs.value()));
			next = false;
		}
		requestAnimationFrame(RAFDraw);
	}

	memo(() => next = true, [inputs]);

	requestAnimationFrame(RAFDraw);

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

let drawCircleDocFn = (props) => (doc) => {
	doc.save();
	doc.lineWidth(props.strokeWeight);
	let x = props.x;
	let y = props.y;
	doc.circle(x, y, 20);
	if (props.stroke) doc.stroke(props.stroke);
	if (props.fill) doc.fill(props.fill);
	doc.restore();
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

	let outputBuffers = memo(
		() =>
			outputs
				.value()
				.map((e) => e.blockId),
		[outputs],
	);

	store.subscribe(BUFFERS.concat([node.id]), (e) => inputs.next(e));

	let props = {
		x: 150,
		y: 150,
		width: 50,
		height: 50,
		fill: undefined,
		stroke: "black",
		strokeWeight: 1,
	};

	inputs.subscribe((v) => {
		Object.values(v).forEach((p) => {
			if (!p) return;
			Object.entries(p).forEach(([key, value]) => {
				if (value == undefined || isNaN(value)) return;
				else if (props[key]) props[key] = value;
			});
		});
		update.next((e) => e + 1);
	});

	// remove this and make it a runna function

	// Assume this function can take all props and just return the data you need
	let tempFn = (p) => ["Circle", { ...props, ...p }];

	// to render vibes
	let drawCircleFn = (x, y) => (ctx) => {
		if (!x) x = props.x;
		if (!y) y = props.y;
		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		ctx.beginPath();
		ctx.arc(x, y, props.width, 0, 2 * Math.PI);
		ctx.stroke();
	};

	let update = reactive(0);

	memo(() => {
		if (!outputBuffers.value()) return;
		outputBuffers.value().forEach((id) => {
			store.apply(["buffers", id], "set", [node.id, {
				// this should be a runa element instead of a function
				draw: tempFn(),
			}], false);
		});
	}, [outputBuffers, update]);

	// This stuff should be on the outside
	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);
	let onstart = (e) => {
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

	let canvas = dom(["canvas", { width: width, height: height }]);
	let el = dom(
		".draggable.node",
		{ style },
		node.id,
		canvas,
		...edges,
		...connects,
	);

	let ctx = canvas.getContext("2d");

	memo(() => {
		ctx.clearRect(0, 0, width.value(), height.value());
		drawCircleFn(width.value() / 2, height.value() / 2)(ctx);
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
		min: 1,
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

const mapRange = (value, inMin, inMax, outMin, outMax) =>
	(value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export let sliderAxis = (key, axis = "horizontal") => (node) => {
	let min = 1;
	let max = 100;
	let value = 14;
	let label = key;

	let r = R(getNodeLocation(node.id), node.id);

	let left = r("x");
	let top = r("y");
	let height = r("height");
	let width = r("width");
	let color = r("color");

	let dimensionmax = axis == "horizontal" ? width.value() : height.value();
	// let mapper = (v) => mapRange(v, 0, dimensionmax, min, max);
	let reversemapper = (v) => {
		let f = mapRange(v, min, max, 0, dimensionmax);
		console.log(f);
		return f;
	};

	let x = reactive(reversemapper(value));

	let outputs = {
		isReactive: true,
		value: () => store.get(EDGEMAP.concat([node.id])),
		subscribe: (fn) => store.subscribe(EDGEMAP.concat([node.id]), fn),
	};

	let outputBuffer = memo(() => outputs.value().map((e) => e.blockId), [
		outputs,
	]);

	let style = memo(
		() => CSSTransform(left, top, width, height) + Color(color.value()),
		[left, top, width, height, color],
	);

	memo(() => {
		if (!outputBuffer.value()) return;
		let v = () => {
			let obj = {};
			console.log(x.value());
			obj[key] = x.value();
			return obj;
		};

		outputBuffer.value().forEach((id) => {
			store.apply(["buffers", id], "set", [node.id, v()], false);
		});
	}, [outputBuffer, x]);

	let onstart = (e) => {
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

	// if (input) input.subscribe((v) => x.next(reversemapper(v)));
	// if (output) x.subscribe((v) => output.next(mapper(v)));

	let stylememo = memo(() => `
		left: ${axis == "horizontal" ? x.value() : -8}px;
		top:  ${axis == "vertical" ? x.value() : -8}px;`, [x]);

	let cursor = dom([".psuedo-cursor.flex-center", { style: stylememo }, label]);
	let el = dom([
		".psuedo-slider",
		{ style },
		cursor,
		...edges,
		...connects,
	]);

	setTimeout(() => {
		let set_left = (v) => axis == "horizontal" ? x.next(v) : null;
		let set_top = (v) => axis == "vertical" ? x.next(v) : null;

		drag(cursor, { set_left, set_top });
		drag(el, {
			set_left: (v) => left.next(v),
			set_top: (v) => top.next(v),
			onstart,
			onend,
		});
	}, 100);

	return el;
};

// GAME PLAN
