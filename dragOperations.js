import { reactive } from "./chowk.js";
import {
	BlockElement,
	constructBlockData,
	constructGroupData,
	GroupElement,
	isRectContained,
	isRectIntersecting,
	Transform,
	uuid,
} from "./block.js";
import { addNode, boundingToSide, state, store } from "./state.js";
import { add_block } from "./arena.js";

let anchor = undefined;

let startX = reactive(0);
let startY = reactive(0);
let endX = reactive(0);
let endY = reactive(0);

function lineIntersectsRect(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
	// rectangle edges
	const edges = [
		// top
		[rx1, ry1, rx2, ry1],
		// right
		[rx2, ry1, rx2, ry2],
		// bottom
		[rx2, ry2, rx1, ry2],
		// left
		[rx1, ry2, rx1, ry1],
	];

	for (const [x3, y3, x4, y4] of edges) {
		const hit = intersect(x1, y1, x2, y2, x3, y3, x4, y4);
		if (hit) {
			return hit;
		}
	}

	return false;
}
// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
	// Check if none of the lines are of length 0
	if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
		return false;
	}

	let denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

	// Lines are parallel
	if (denominator === 0) {
		return false;
	}

	let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
	let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

	// is the intersection along the segments
	if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
		return false;
	}

	// Return a object with the x and y coordinates of the intersection
	let x = x1 + ua * (x2 - x1);
	let y = y1 + ua * (y2 - y1);

	return { x, y };
}

export let dragTransforms = { startX, startY, endX, endY };

/** @type {( "pan" | "making-block" | 'making-group' | 'select' | 'zoom' | 'connect' )}*/
let dragAction = "pan";

export let dragOperations = {
	onpointerdown: (e) => {
		let target = e.target;
		if (e.target != document.querySelector(".container")) return;
		// state.selected.next([])

		state.canceled.next(false);
		state.selected.next([]);

		startX.next(e.offsetX);
		startY.next(e.offsetY);
		endX.next(e.offsetX);
		endY.next(e.offsetY);

		target.setPointerCapture(e.pointerId);

		if (e.metaKey && e.shiftKey) dragAction = "making-group";
		else if (e.shiftKey) {
			dragAction = "zoom";
			dragAction = "select";
		} else if (e.metaKey) {
			dragAction = "making-block";
		} else {
			anchor = {
				x: state.canvasX.value(),
				y: state.canvasY.value(),
				scale: state.canvasScale.value(),
			};

			state.holdingCanvas.next(true);
		}
	},
	onpointermove: (e) => {
		let target = e.target;

		if (!target.hasPointerCapture(e.pointerId)) return;

		const deltaX = e.movementX / state.canvasScale.value();
		const deltaY = e.movementY / state.canvasScale.value();
		endX.next((v) => v + deltaX);
		endY.next((v) => v + deltaY);

		if (anchor) {
			state.canvasX.next(anchor.x + startX.value() - endX.value());
			state.canvasY.next(anchor.y + startY.value() - endY.value());
		}
	},
	onpointerup: (e) => {
		let target = e.target;
		state.holdingCanvas.next(false);
		let pointsToAt = (x1, y1, x2, y2) => ({
			x: Math.min(x1, x2),
			y: Math.min(y1, y2),
			width: Math.abs(x2 - x1),
			height: Math.abs(y2 - y1),
		});
		let { x, y, width, height } = pointsToAt(
			startX.value(),
			startY.value(),
			endX.value(),
			endY.value(),
		);

		target.releasePointerCapture(e.pointerId);

		startX.next(0);
		startY.next(0);
		endX.next(0);
		endY.next(0);

		if (anchor) {
			anchor = undefined;
			return;
		}

		if (state.canceled.value()) {
			state.canceled.next(false);
			return;
		}

		if (dragAction == "making-block") {
			dragAction = "pan";
			if (width < 150 || height < 150) return;
			addNode({
				x,
				y,
				width,
				height,
				color: "1",
				type: state.making_node,
				id: uuid(),
				data: {},
			});
		} // else if (dragAction == 'making-group') {
		// 	dragAction = 'pan'
		// 	if (width < 250 || height < 250) return
		// 	addNode({x, y, width, height, color: '2', type: 'circle', id: uuid(), data: {}})
		// }

		// else if (dragAction == 'zoom') {
		// 	let heightRatio = 1+((window.innerHeight - height)/window.innerHeight)
		// 	let widthRatio = 1+((window.innerWidth - width)/window.innerWidth)
		// 	let scale = Math.max(widthRatio, heightRatio)

		// 	state.canvasScale.next(scale)
		// 	state.canvasX.next(x)
		// 	state.canvasY.next(y)
		// }

		else if (dragAction == "select") {
			let nodes = store.get(["data", "nodes"]);
			let edges = store.get(["data", "edges"]);
			let selection = [];
			let connectionSelection = [];
			nodes.forEach((node) => {
				let fn = isRectIntersecting;
				if (node.type == "group") fn = isRectContained;
				fn(Transform(x, y, width, height), node)
					? selection.push(node.id)
					: null;
			});

			edges.forEach((edge) => {
				// get x lines
				let from = store.get(["data", "nodes"]).find((f) =>
					f.id == edge.fromNode
				);
				let to = store.get(["data", "nodes"]).find((f) => f.id == edge.toNode);

				let fromB = boundingToSide(from, edge.fromSide);
				let toB = boundingToSide(to, edge.toSide);

				let x1 = fromB.x;
				let y1 = fromB.y;
				let x2 = toB.x;
				let y2 = toB.y;

				if (lineIntersectsRect(x1, y1, x2, y2, x, y, x + width, y + height)) {
					console.log("OK?", x1, y1, x2, y2, x, y, width, height);
					connectionSelection.push(edge.id);
				}
			});

			state.selected.next(selection);

			if (connectionSelection.length != 0) {
				state.selectedConnection.next(connectionSelection);
			}
		}
	},
};
