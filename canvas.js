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
		if (drawables.length == 0) return;
		const doc = new PDFDocument({ layout: "landscape" });
		let stream = doc.pipe(blobStream());
		drawables.forEach((fn) => {
			if (!fn) return;
			fn.draw ? fn.draw(doc) : console.log("NOT A FN", fn);
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

	let outputBuffer = memo(
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
		fill: undefined,
		stroke: "black",
		strokeWeight: 1,
	};

	inputs.subscribe((v) => {
		Object.values(v).forEach((p) => {
			if (!p) return;
			Object.entries(p).forEach(([key, value]) => {
				if (props[key]) props[key] = value;
			});
		});
		update.next((e) => e + 1);
	});

	let drawCircleDocFn = (x, y) => (doc) => {
		doc.save();

		doc.lineWidth(props.strokeWeight);
		if (!x) x = props.x;
		if (!y) y = props.y;
		doc.circle(x, y, size.value() / 5);
		if (props.stroke) doc.stroke(props.stroke);
		if (props.fill) doc.fill(props.fill);

		doc.restore();
	};

	let drawCircleFn = (x, y) => (ctx) => {
		if (!x) x = props.x;
		if (!y) y = props.y;
		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		ctx.beginPath();
		ctx.arc(x, y, size.value() / 2, 0, 2 * Math.PI);
		ctx.stroke();
	};

	let size = reactive(50);
	let update = reactive(0);

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
		outputBuffer.value().forEach((id) => {
			store.apply(["buffers", id], "set", [node.id, {
				draw: drawCircleDocFn(),
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
		drawCircleFn(width.value() / 2, height.value() / 2)(ctx);
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

// GAME PLAN
