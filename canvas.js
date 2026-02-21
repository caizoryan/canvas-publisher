// Reactive interface:
// ~> (to plug into the store)
import { button, Color, connectors, CSSTransform, resizers } from "./block.js";
import { memo, reactive } from "./chowk.js";
import { dom } from "./dom.js";
import { p5 } from "./p5.js";
import { Q5 } from "./q5.js";
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
let oracleBuffer;
let fungalBuffer;

fetch(`./font.otf`).then((res) => res.arrayBuffer()).then((res) =>
	fontBuffer = res
);

fetch(`./oracle.otf`).then((res) => res.arrayBuffer()).then((res) => {
	console.log("RES!", res);
	oracleBuffer = res;
});

fetch(`./fungal.ttf`).then((res) => res.arrayBuffer()).then((res) =>
	fungalBuffer = res
);

let cmykToRGB = (C, M, Y, K) => {
	var r = 255 * (1 - C) * (1 - K);
	var g = 255 * (1 - M) * (1 - K);
	var b = 255 * (1 - Y) * (1 - K);
	console.log(r, g, b);
	return [r, g, b];
};

export const renderPDFCanvas = (node, inputs) => {
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

		doc.registerFont("Oracle", oracleBuffer);
		doc.registerFont("Fungal", fungalBuffer);
		doc.registerFont("Hermit", fontBuffer);

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
		[
			".bottom-bar",
			button("PIN", setPinned),
			button("toggle", () => paused = !paused),
			button("download", () => lastPdf ? window.open(lastPdf, "_blank") : null),
		],
		canvas,
	];
};

export const renderCanvas = (node, inputs) => {
	let pageWidth = 612;
	let pageHeight = 792;
	let paused = false;

	let canvas = dom([".canvas"]);

	let p;
	let init = (pp) => {
		p = pp;
		p.setup = () => {
			p.createCanvas(pageHeight, pageWidth);
			// p.background(252, 255, 0);
		};
	};

	setTimeout(() => {
		new p5(init, canvas);
	}, 150);

	let draw = (drawables) => {
		if (drawables.length == 0) return;

		let fns = {
			"Circle": drawCircle,
			"Text": drawText,
			"Image": drawImageDocFn,
			"Line": drawLine,
			"Group": (props) => (doc) => {
				let drawables = props.draw ? props.draw : [];

				drawables.forEach((fn) => {
					if (!fn) return;
					typeof fns[fn[0]] == "function"
						? fns[fn[0]](fn[1])(p)
						: console.log("ERROR: Neither a fn nor a key");
				});
			},
		};

		p.background(250);
		// console.log("WHAT THE FUCK");

		fns.Group({ draw: drawables })(p);
	};

	// wrap this in a RAF
	let next = false;
	function RAFDraw() {
		if (next && !paused) {
			// sort these into drawables and properties vibes (props can be width/height...)
			let i = inputs.value();
			if (i && i.draw) draw(i.draw);
			next = false;
		}
		requestAnimationFrame(RAFDraw);
	}

	inputs.subscribe(() => next = true);
	setTimeout(() => {
		requestAnimationFrame(RAFDraw);
	}, 150);

	return [
		canvas,
	];
};

export const physariumCanvas = (node, inputs, updateOut) => {
	let container = [".p5"];
	let r = dataR(getNodeLocation(node.id), node.id);
	let instructionPlug = r("draw");

	let v = (x, y) => ({ x, y });

	function createGrid(width, cellSize) {
		const cellsPerRow = Math.floor(width / cellSize);
		const totalCells = cellsPerRow * cellsPerRow;

		// initialize grid
		const grid = new Array(totalCells).fill(null).map((_, index) => {
			const x = index % cellsPerRow;
			const y = Math.floor(index / cellsPerRow);

			return {
				x: x * cellSize,
				y: y * cellSize,
				size: cellSize,
				brightness: Math.random() * .1,
				marked: true,
			};
		});

		function getCell(px, py) {
			if (
				px < 0 ||
				py < 0 ||
				px >= width ||
				py >= width
			) {
				return null;
			}

			const cellX = Math.floor(px / cellSize);
			const cellY = Math.floor(py / cellSize);
			const index = cellY * cellsPerRow + cellX;

			return grid[index];
		}

		function iterate(fn) {
			grid.forEach(fn);
		}

		// closure function
		return { getCell, iterate };
	}

	let state = {};

	state.loaded = 0;
	state.colors = ["yellow", "blue", "red"];
	state.colors = ["#0468AF", "#058EF0", "#4BB2FB"];
	state.colors = ["#025002", "#119711", "#35BB35"];

	state.chars = [".", ":", "-", "=", "+", "*", "#", "%"];
	// state.chars = ["c", "f", "u", "l", ">", ")", "))"];
	// state.chars = "/|\\xo-.+=".split("");
	state.moldCount = 15;

	state.width = window.innerWidth;
	state.height = window.innerHeight;

	state.width = 712;
	state.height = 642;

	state.x = 10;
	state.y = 282;

	state.size = 8;
	state.sensorAngle = 45;
	state.sensorDist = 25;
	state.rotationAngle = state.sensorAngle;
	state.grid = createGrid(state.width, state.size);
	state.decay = .015;

	let mold = () => {
		let x = Math.random() * state.width;
		let y = Math.random() * state.height;
		let r = 10;
		let dist = state.sensorDist;
		let heading = Math.random() * 360;

		let vx = Math.cos(heading);
		let vy = Math.sin(heading);

		let sensorLeftPos = v(0, 0);
		let sensorRightPos = v(0, 0);
		let sensorFrontPos = v(0, 0);

		let update = (p) => {
			vx = Math.cos(heading) * dist;
			vy = Math.sin(heading) * dist;

			x = x + vx;
			y = y + vy;

			if (x > state.width) x = x - state.width + 100;
			if (y > state.height) y = y - state.height + 100;

			if (x < 0) x = x * -1 + 100;
			if (y < 0) y = y * -1 + 100;

			let cell = state.grid.getCell(x, y);
			if (
				cell &&
				!cell.marked
			) cell.brightness = 1;

			sensorRightPos.x = x +
				state.sensorDist * Math.cos(heading + state.sensorAngle);
			sensorRightPos.y = y +
				state.sensorDist * Math.sin(heading + state.sensorAngle);

			sensorLeftPos.x = x +
				state.sensorDist * Math.cos(heading - state.sensorAngle);
			sensorLeftPos.y = y +
				state.sensorDist * Math.sin(heading - state.sensorAngle);

			sensorFrontPos.x = x + state.sensorDist * Math.cos(heading);
			sensorFrontPos.y = y + state.sensorDist * Math.sin(heading);

			let rpix = state.grid.getCell(sensorRightPos.x, sensorRightPos.y);
			let lpix = state.grid.getCell(sensorLeftPos.x, sensorLeftPos.y);
			let fpix = state.grid.getCell(sensorFrontPos.x, sensorFrontPos.y);

			let rpixB = rpix ? rpix.brightness : 0;
			let lpixB = lpix ? lpix.brightness : 0;
			let fpixB = fpix ? fpix.brightness : 0;

			if (fpixB > rpixB && fpixB > lpixB) { }
			else if (fpixB < rpixB && fpixB < lpixB) {
				if (Math.random() > .5) heading += state.rotationAngle;
				else heading -= state.rotationAngle;
			} else if (rpixB > lpixB) heading += state.rotationAngle;
			else if (rpixB < lpixB) heading -= state.rotationAngle;
		};

		return { update };
	};

	let el = dom(container);
	let p;

	let alphabetPoints = {};
	let pointsss;

	let setGrid = (points) => {
		state.loaded = 0;
		pointsss = points;
		state.grid.iterate((e) => e.marked = true);
		points.forEach((e) => {
			let pix = state.grid.getCell(e.x, e.y);
			if (pix) pix.marked = false;
		});
	};

	let initp5 = (pp) => {
		p = pp;
		let font;
		p.preload = () => {
			font = p.loadFont("./font.otf");
		};
		p.setup = () => {
			p.createCanvas(state.width, state.height);
			p.textFont("Times");
			p.frameRate(40);
			p.textSize(454);
			let word = "physarium algorithm is now blue";
			word = "Youth Invasive Plant Initiative";

			Array.from(new Set(word.split(" "))).forEach((letter) => {
				p.noStroke();
				p.fill(0);
				alphabetPoints[letter] = p.textToPoints(
					letter,
					state.x,
					state.y,
					.1,
					.5,
				);
				p.noFill();
				p.stroke(0);
				p.strokeWeight(2);
				// alphabetOutlinePoints[letter] = p.textToPoints(letter, 100, 856, .1, .5);
			});

			let letters = word.split(" ");
			let index = 0;

			setInterval(() => {
				setGrid(
					alphabetPoints[letters[index % letters.length]],
					// alphabetOutlinePoints[letters[index % letters.length]],
				);
				index++;
			}, 4000);

			p.textFont("monospace");
			p.textSize(state.size * 1.5);
		};
		p.draw = (ts) => {
			RAFDraw();
		};
	};

	new Q5(initp5, el);

	let instructions = [];
	let molds = Array(state.moldCount).fill(0).map((e) => mold());
	function RAFDraw() {
		instructions = [];
		p.background(255);

		molds.forEach((m) => m.update(p));

		let last;
		state.grid.iterate((pix) => {
			let char = state.chars[Math.floor(pix.brightness * state.chars.length)];
			// char = "/";

			if (pix.brightness > 0) {
				if (pix.brightness > .9) {
					p.fill(state.colors[1]);
					p.stroke(state.colors[1]);
					p.strokeWeight(pix.brightness * 2 + 1);
					p.ellipse(pix.x, pix.y, state.size * .8);
					instructions.push(["Circle", {
						x: pix.x,
						y: pix.y,
						radius: (state.size * .8) / 2,
						strokeWeight: pix.brightness * 2 + 1,
						stroke: state.colors[1],
						fill: state.colors[1],
					}]);
				} else {
					p.fill(state.colors[2]);
					p.strokeWeight(2.5);
					p.stroke(state.colors[2]);
					p.text(char, pix.x, pix.y);
					instructions.push(["Text", {
						text: char,
						x: pix.x,
						y: pix.y,
						strokeWeight: pix.brightness * 2 + 1,
						stroke: state.colors[1],
						fill: state.colors[1],
					}]);
				}

				// p.noFill();
				// p.stroke(state.colors[0]);
				// if (last) {
				// 	let diffX = p.abs(pix.x - last.x);
				// 	let diffY = p.abs(pix.y - last.y);
				//
				// 	if (
				// 		diffX < state.size * 6 && diffX > state.size * 2 &&
				// 		diffY < state.size * 6
				// 	) {
				// 		p.curve(
				// 			last.x - 40,
				// 			last.y + 45,
				// 			last.x,
				// 			last.y,
				// 			pix.x,
				// 			pix.y,
				// 			pix.x + 40,
				// 			pix.y + 45,
				// 		);
				// 	}
				// 	p.strokeWeight(1);
				// }
				//
				// last = pix;
			}

			pix.brightness -= state.decay;
		});

		p.text("ANGLE: " + state.rotationAngle, 10, 10);

		if (Array.isArray(pointsss)) {
			p.fill(state.colors[1]);
			p.noStroke();
			state.loaded += 65;
			pointsss.forEach((m, i) => {
				if (i > state.loaded) return;
				p.ellipse(m.x, m.y, 3);
				instructions.push(["Circle", {
					fill: state.colors[1],
					radius: 3 / 2,
					x: m.x,
					y: m.y,
				}]);
			});

			// let lastPoint;
			// pointsssOutline.forEach((m, i) => {
			// 	p.noFill();
			// 	p.stroke(state.colors[1]);
			// 	if (lastPoint) {
			// 		let diffX = p.abs(m.x - lastPoint.x);
			// 		let diffY = p.abs(m.y - lastPoint.y);
			//
			// 		if (diffX < 45 && diffX > 15 && diffY < 45) {
			// 			p.curve(
			// 				lastPoint.x - 40,
			// 				lastPoint.y + 45,
			// 				lastPoint.x,
			// 				lastPoint.y,
			// 				m.x,
			// 				m.y,
			// 				m.x + 40,
			// 				m.y + 45,
			// 			);
			// 		}
			// 		p.strokeWeight(1);
			// 	}
			//
			// 	lastPoint = m;
			// });
		}

		instructionPlug.next(instructions);
		// updateOut();

		// molds.forEach((m) => m.draw(p));
	}

	return [el];
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

let drawCircle = (props) => (p) => {
	if (props.strokeWeight) p.strokeWeight(props.strokeWeight);
	let x = props.x ? props.x : 0;
	let y = props.y ? props.y : 0;
	props.stroke != undefined ? p.stroke(props.stroke) : p.noStroke();
	props.fill != undefined
		? Array.isArray(props.fill) ? p.fill(...props.fill) : p.fill(props.fill)
		: p.nofill();
	p.circle(x, y, props.radius ? props.radius * 2 : 5);
};

let availableFonts = ["Times-Roman", "Hermit", "Oracle", "Fungal"];

let drawTextDocFn = (props) => (doc) => {
	doc.save();
	let x = props.x;
	let y = props.y;
	let width = props.width ? props.width : 100;
	let height = props.height ? props.height : 100;
	let text = props.text;
	let fontSize = props.fontSize ? props.fontSize : 12;
	let fontFamily = props.fontFamily;
	// let stroke = props.stroke ? true : false;

	if (props.fill) doc.fillColor(props.fill);
	if (fontFamily && availableFonts.includes(fontFamily)) doc.font(fontFamily);
	// if (props.stroke) doc.stroke(props.stroke);
	doc.fontSize(fontSize);
	doc.text(text, x, y, { width, height });

	if (props.boundingBox) {
		doc.rect(x, y, width, height);
		doc.lineWidth(props.boundingBox);
		doc.stroke();
	}
	// if (props.stroke && props.fill) doc.fillAndStroke(props.fill, props.stroke);

	doc.restore();
};

let drawText = (props) => (p) => {
	let x = props.x;
	let y = props.y;
	let width = props.width ? props.width : 100;
	let height = props.height ? props.height : 100;
	let text = props.text;
	let fontSize = props.fontSize ? props.fontSize : 12;
	let fontFamily = props.fontFamily;
	// let stroke = props.stroke ? true : false;

	props.fill != undefined
		? Array.isArray(props.fill) ? p.fill(...props.fill) : p.fill(props.fill)
		: p.noFill();

	props.stroke != undefined
		? Array.isArray(props.stroke)
			? p.stroke(...props.stroke)
			: p.stroke(props.stroke)
		: p.noStroke();

	if (fontFamily) p.textFont(fontFamily);
	// if (props.stroke) doc.stroke(props.stroke);
	p.textSize(fontSize);
	p.text(text, x, y, width, height);

	if (props.boundingBox) {
		p.stroke(1);
		p.strokeWeight(props.boundingBox);
		p.rect(x, y, width, height);
	}
	// if (props.stroke) doc.fillAndStroke(props.fill, props.stroke);
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
	let points = props.points;
	if (props.points.length < 2) return;
	// let start = points[0];
	// let x1 = start.x;
	// let y1 = start.y;
	//
	// let end = points[1];
	// let x2 = end.x;
	// let y2 = end.y;

	doc.save();
	doc.lineWidth(props.strokeWeight);
	doc.moveTo(points[0].x, points[0].y);
	points.slice(1).filter((e) =>
		e != undefined &&
		typeof e == "object"
	).forEach(
		(e) => doc.lineTo(e.x, e.y),
	);
	// .lineTo(x2, y2);
	if (props.stroke) doc.stroke(props.stroke);
	doc.restore();
};

let drawLine = (props) => (doc) => {
	let points = props.points;
	if (props.points.length < 2) return;

	if (props.strokeWeight) doc.strokeWeight(props.strokeWeight);
	if (props.stroke) doc.stroke(props.stroke);

	let last;
	points.filter((e) =>
		e != undefined &&
		typeof e == "object"
	).forEach(
		(e) => {
			if (last) doc.line(last.x, last.y, e.x, e.y);
			last = e;
		},
	);
};
