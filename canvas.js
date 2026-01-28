// Reactive interface:
// ~> (to plug into the store)
import { button, Color, connectors, CSSTransform, resizers } from "./block.js";
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

export let pinnedCanvas = dom(["canvas.pinned"]);

let pinnedContext = pinnedCanvas.getContext("2d");
let pinnedTask;
pinnedContext.beginPath();
pinnedContext.rect(20, 20, 150, 100);
pinnedContext.stroke();

let updatePinned = (fn) => fn(pinnedContext, pinnedCanvas);

let queued = {};
try {
	PDFJS.GlobalWorkerOptions.workerSrc = PDFWorker;
	console.log("TRIED");
} catch (e) {
	window.pdfjsWorker = PDFWorker;
	console.log("CAUGHT");
}

export let addToSelection = (block, e) => {
	if (e.shiftKey) state.selected.next((e) => [...e, block.id]);
	else state.selected.next([block.id]);
};

// ~~~~~~~~~~~~~~~~~~~
export let R = (location, id) => (key) => ({
	isReactive: true,
	value: () => store.get(location.concat([key])),
	next: (v) => store.tr(location, "set", [key, v], false),
	subscribe: (fn) => subscribeToId(id, [key], fn),
});

export let dataR = (location, id) => (key) => ({
	isReactive: true,
	value: () => store.get(location.concat(["data", key])),
	next: (v) => store.tr(location.concat(["data"]), "set", [key, v], false),
	subscribe: (fn) => subscribeToId(id, ["data", key], fn),
});

export const renderCanvas = (node, inputs) => {
	let pageWidth = 612;
	let pageHeight = 792;

	// let inputs = reactive({});
	// // from for this node
	// store.subscribe(BUFFERS.concat([node.id]), (e) => inputs.next(e));
	let isPinned = memo(() => state.pinnedNode.value() == node.id, [
		state.pinnedNode,
	]);

	let setPinned = () => {
		state.pinnedNode.next(node.id);
		next = true;
	};

	let canvas = dom(["canvas"]);
	let ctx = canvas.getContext("2d");

	function loadAndRender(url, ctx) {
		let start = new Date();
		var loadingTask = PDFJS.getDocument(url);
		loadingTask.promise.then(
			(pdf) => renderPDF(pdf, start, ctx),
			(reason) => console.error(reason),
		);
	}

	let renderPDF = (pdf, start, ctxx) => {
		let end = new Date();
		let ms = end.valueOf() - start.valueOf();
		console.log("PDF loaded in", ms);

		// Fetch the first page
		let pageNumber = 1;
		pdf.getPage(pageNumber).then(function(page) {
			console.log("Page loaded");
			let isPinnedTask = ctxx == pinnedContext;
			if (isPinnedTask) console.log("IS PINNED TASK");
			let scale = 1;
			let viewport = page.getViewport({ scale: scale });

			let _canvas = isPinnedTask ? pinnedCanvas : canvas;
			_canvas.height = viewport.height;
			_canvas.width = viewport.width;
			// Render PDF page into canvas context
			let renderContext = { canvasContext: ctxx, viewport: viewport };

			if (isPinnedTask) {
				if (pinnedTask) pinnedTask.cancel();
				pinnedTask = undefined;
			} else if (queued[node.id]) {
				queued[node.id].cancel();
				queued[node.id] = undefined;
			}

			let renderTask = page.render(renderContext);
			let setTask = (t) => isPinnedTask ? pinnedTask = t : queued[node.id] = t;
			setTask(renderTask);
			renderTask.promise.then(() => setTask(undefined));
		});
	};

	let draw = (drawables, ctx) => {
		if (drawables.length == 0) return;
		if (isPinned.value() && ctx != pinnedContext) {
			console.log("IS PINNED!");
			draw(drawables, pinnedContext);
			// return;
		}

		const doc = new PDFDocument({
			layout: "landscape",
			size: [pageWidth, pageHeight],
		});

		let fns = {
			"Circle": drawCircleDocFn,
			"Group": (drawables) => (doc) => {
				drawables.forEach((fn) => {
					if (!fn) return;
					typeof fns[fn[0]] == "function"
						? fns[fn[0]](fn[1])(doc)
						: console.log("ERROR: Neither a fn nor a key");
				});
			},
		};

		let stream = doc.pipe(blobStream());
		doc.rect(0, 0, pageHeight, pageWidth);
		doc.fill([0, 0, 0, 5]);
		fns.Group(drawables)(doc);
		doc.end();
		stream.on(
			"finish",
			() => loadAndRender(stream.toBlobURL("application/pdf"), ctx),
		);
	};

	// wrap this in a RAF
	let next = false;
	function RAFDraw() {
		if (next) {
			// sort these into drawables and properties vibes (props can be width/height...)
			let i = inputs.value();
			if (i && i.draw) draw(i.draw, ctx);
			next = false;
		}
		requestAnimationFrame(RAFDraw);
	}

	inputs.subscribe(() => next = true);
	requestAnimationFrame(RAFDraw);

	return [canvas, button("PIN", setPinned)];
};

let drawCircleDocFn = (props) => (doc) => {
	doc.save();
	doc.lineWidth(props.strokeWeight);
	let x = props.x;
	let y = props.y;
	doc.circle(x, y, props.radius);
	console.log("FIll is array", Array.isArray(props.fill), props.fill);
	if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);
	else {
		if (props.stroke) doc.stroke(props.stroke);
		if (props.fill) doc.fill(props.fill);
	}

	doc.restore();
};

let getProps = (id) => store.get(getNodeLocation(id).concat(["data"]));

export const renderCircle = (node, input, updateOut) => {
	let r = R(getNodeLocation(node.id), node.id);

	let height = r("height");
	let width = r("width");

	// // handling inputs and subscriptions
	let inputs = reactive({});
	//

	store.subscribe(BUFFERS.concat([node.id]), (e) => inputs.next(e));

	// to render vibes
	let drawCircleFn = (x, y) => (ctx) => {
		let props = getProps(node.id);

		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		// also do fill

		ctx.beginPath();
		ctx.arc(x, y, props.radius, 0, 2 * Math.PI);
		ctx.stroke();
	};

	let slider = dom(["input", {
		type: "range",
		min: 1,
		max: 150,
		step: 1,
		oninput: (e) => {
			let v = parseFloat(e.target.value);
			store.apply(getNodeLocation(node.id).concat(["data"]), "set", [
				"radius",
				v,
			], false);

			updateOut();
		},
	}]);

	// This stuff should be on the outside
	let canvas = dom(["canvas", { width: width, height: height }]);
	let ctx = canvas.getContext("2d");

	memo(() => {
		ctx.clearRect(0, 0, width.value(), height.value());
		drawCircleFn(width.value() / 2, height.value() / 2)(ctx);
	}, [width, height, inputs]);

	return [slider, canvas];
};

const mapRange = (value, inMin, inMax, outMin, outMax) =>
	(value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export let sliderAxis = (axis = "horizontal") => (node, ins, updateOut) => {
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

	let colorSlider = (v, color) => {
		return ["input.color", {
			type: "range",
			min: 0,
			max: 100,
			step: 1,
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
	let r = R(getNodeLocation(node.id), node.id);
	let update = inputs;

	let props = getProps(node.id);
	let val = reactive(props.value.reduce((acc, v) => acc += v, 0));

	update.subscribe(() => {
		props = getProps(node.id);
		val.next(props.value.reduce((acc, v) => acc += v, 0));
	});

	let cursor = dom(["span", val]);

	return [cursor];
};

// GAME PLAN
