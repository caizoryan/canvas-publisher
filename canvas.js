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

export const renderCanvas = (node, inputs) => {
	let pageWidth = 612;
	let pageHeight = 792;

	let canvas = dom(["canvas"]);
	// let inputs = reactive({});
	// // from for this node
	// store.subscribe(BUFFERS.concat([node.id]), (e) => inputs.next(e));
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
			let scale = 1.5;
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
			typeof fns[fn[0]] == "function"
				? fns[fn[0]](fn[1])(doc)
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
			let i = inputs.value();
			if (i && i.draw) draw(i.draw);
			next = false;
		}
		requestAnimationFrame(RAFDraw);
	}

	inputs.subscribe(() => next = true);
	requestAnimationFrame(RAFDraw);

	return [canvas];
};

let drawCircleDocFn = (props) => (doc) => {
	doc.save();
	doc.lineWidth(props.strokeWeight);
	let x = props.x;
	let y = props.y;
	doc.circle(x, y, props.radius);
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

export let sliderAxis =
	(key, axis = "horizontal") => (node, ins, updateOut) => {
		let min = 1;
		let max = 100;
		let value = 14;
		let label = key;

		let r = R(getNodeLocation(node.id), node.id);

		let height = r("height");
		let width = r("width");

		let dimensionmax = axis == "horizontal" ? width.value() : height.value();
		// let mapper = (v) => mapRange(v, 0, dimensionmax, min, max);
		let reversemapper = (v) => {
			let f = mapRange(v, min, max, 0, dimensionmax);
			return f;
		};

		let x = reactive(reversemapper(value));
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
			label,
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
	let props = getProps(node.id);
	let key = reactive(props.key || "x");

	key.subscribe((v) => {
		if (v == "") return;
		store.apply(
			getNodeLocation(node.id).concat(["data"]),
			"set",
			["key", v],
			false,
		);
	});

	let cursor = dom(["input", {
		type: "text",
		oninput: (e) => {
			key.next(e.target.value.trim());
			updateOut();
		},
		value: key,
	}]);

	return [cursor];
};

export let add = (node, inputs, updateOut) => {
	// Make an R out of key
	let r = R(getNodeLocation(node.id), node.id);
	let update = inputs;
	let val = reactive(0);

	let props = getProps(node.id);

	update.subscribe(() => {
		props = getProps(node.id);
		console.log("rpops", props);
		// val.next(props.value.reduce((acc, v) => acc += v, 0));
	});

	let cursor = dom(["span", val]);

	return [cursor];
};

// GAME PLAN
