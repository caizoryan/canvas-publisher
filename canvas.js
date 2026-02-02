// Reactive interface:
// ~> (to plug into the store)
import { button, Color, connectors, CSSTransform, resizers } from "./block.js";
import { memo, reactive } from "./chowk.js";
import { dom } from "./dom.js";
import { getNodeLocation, state, store, subscribeToId } from "./state.js";

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

let queued = {};
try {
	PDFJS.GlobalWorkerOptions.workerSrc = PDFWorker;
	console.log("TRIED");
} catch (e) {
	window.pdfjsWorker = PDFWorker;
	console.log("CAUGHT");
}

// ~~~~~~~~~~~~~~~~~~~
export let R = (location, id) => (key) => ({
	isReactive: true,
	value: () => store.get(location.concat([key])),
	next: (v, track = false) => store.tr(location, "set", [key, v], track),
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
			(reason) => console.log("All good", reason),
		);
	}

	let renderPDF = (pdf, start, ctxx) => {
		let end = new Date();
		let ms = end.valueOf() - start.valueOf();

		// Fetch the first page
		let pageNumber = 1;
		pdf.getPage(pageNumber).then(function(page) {
			let isPinnedTask = ctxx == pinnedContext;
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
			renderTask.promise.catch((e) => console.log("All good: ", e));
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
	if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);
	else {
		if (props.stroke) doc.stroke(props.stroke);
		if (props.fill) doc.fill(props.fill);
	}

	doc.restore();
};
