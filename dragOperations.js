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
import { addNode, state, store } from "./state.js";
import { add_block } from "./arena.js";

let anchor = undefined;

let startX = reactive(0);
let startY = reactive(0);
let endX = reactive(0);
let endY = reactive(0);

export let dragTransforms = { startX, startY, endX, endY };

/** @type {( "pan" | "making-block" | 'making-group' | 'select' | 'zoom')}*/
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
			let selection = [];
			nodes.forEach((node) => {
				let fn = isRectIntersecting;
				if (node.type == "group") fn = isRectContained;
				fn(Transform(x, y, width, height), node)
					? selection.push(node.id)
					: null;
			});

			state.selected.next(selection);
		}
	},
};
