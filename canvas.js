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
window.pdfjsWorker = PDFWorker;
// window.pdfjsWorker = false;

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

let fontBuffer;
const response = await fetch(`./font.otf`);
fontBuffer = await response.arrayBuffer();
export const renderCanvas = (node, inputs) => {
	let pageWidth = 612;
	let pageHeight = 792;
	let paused = true;

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

	let lastPdf;
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
			margins: 0,
		});

		doc.registerFont("test", fontBuffer);
		doc.font("test");

		let fns = {
			"Circle": drawCircleDocFn,
			"Text": drawTextDocFn,
			"Image": drawImageDocFn,
			"Line": drawLineDocFn,
			"Group": (props) => (doc) => {
				let drawables = props.draw ? props.draw : [];

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
		fns.Group({ draw: drawables })(doc);
		doc.end();
		stream.on(
			"finish",
			() => {
				lastPdf = stream.toBlobURL("application/pdf");
				loadAndRender(lastPdf, ctx);
			},
		);
	};

	// wrap this in a RAF
	let next = false;
	function RAFDraw() {
		if (next && !paused) {
			// sort these into drawables and properties vibes (props can be width/height...)
			let i = inputs.value();
			if (i && i.draw) draw(i.draw, ctx);
			next = false;
		}
		requestAnimationFrame(RAFDraw);
	}

	inputs.subscribe(() => next = true);
	requestAnimationFrame(RAFDraw);

	return [
		canvas,
		button("PIN", setPinned),
		button("toggle", () => paused = !paused),
		button("download", () => lastPdf ? window.open(lastPdf, "_blank") : null),
	];
};

let drawCircleDocFn = (props) => (doc) => {
	doc.save();
	if (props.strokeWeight) doc.lineWidth(props.strokeWeight);
	let x = props.x ? props.x : 0;
	let y = props.y ? props.y : 0;
	doc.circle(x, y, props.radius ? props.radius : 5);
	if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);
	else {
		if (props.stroke) doc.stroke(props.stroke);
		if (props.fill) doc.fill(props.fill);
	}

	doc.restore();
};

let drawTextDocFn = (props) => (doc) => {
	doc.save();
	let x = props.x;
	let y = props.y;
	let width = props.width ? props.width : 100;
	let height = props.height ? props.height : 100;
	let text = props.text;
	let fontSize = props.fontSize ? props.fontSize : 12;
	// let stroke = props.stroke ? true : false;

	if (props.fill) doc.fillColor(props.fill);
	// if (props.stroke) doc.stroke(props.stroke);
	doc.fontSize(fontSize);
	doc.text(text, x, y, { width, height });
	doc.rect(x, y, width, height);
	doc.lineWidth(1);
	doc.stroke();
	// if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);
	// else {
	// }

	doc.restore();
};

let drawImageDocFn = (props) => (doc) => {
	// return;
	doc.save();
	let x = props.x;
	let y = props.y;
	let image = props.image;

	let width = props.width ? props.width : 100;

	if (!props.image) return;
	if (props.fill) doc.fillColor(props.fill);
	// if (props.stroke) doc.stroke(props.stroke);
	doc.image(image, x, y, { width });
	// if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);
	// else {
	// }

	doc.restore();
};

let drawImageCanvasFn = (props) => (ctx, canvas) => {
	let x = props.x;
	let y = props.y;
	let image = props.image;

	let width = props.width ? props.width : 100;

	if (!props.image) return;
	if (props.fill) doc.fillColor(props.fill);
	const ratio = img.height / img.width;
	const targetHeight = targetWidth * ratio;

	canvas.width = targetWidth;
	canvas.height = targetHeight;

	ctx.drawImage(img, x, y, targetWidth, targetHeight);
};

let drawLineDocFn = (props) => (doc) => {
	let start = props.start;
	let x1 = start.x;
	let y1 = start.y;

	let end = props.end;
	let x2 = end.x;
	let y2 = end.y;

	doc.save();
	doc.lineWidth(props.strokeWeight);
	doc.moveTo(x1, y1)
		.lineTo(x2, y2);
	if (props.stroke) doc.stroke(props.stroke);
	doc.restore();
};
