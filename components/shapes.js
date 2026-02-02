import { getProps, R } from "./index.js";
import { getNodeLocation } from "../state.js";
import { dom } from "../dom.js";
import { V } from "../schema.js";
import { memo } from "../chowk.js";

const circleRender = (node, inputs) => {
	let r = R(getNodeLocation(node.id), node.id);

	let height = r("height");
	let width = r("width");

	// to render vibes
	let drawCircleFn = (x, y) => (ctx) => {
		let props = getProps(node.id);

		ctx.strokeStyle = "black";
		ctx.strokeWidth = 8;
		// also do fill

		ctx.beginPath();
		ctx.arc(x, y, Math.abs(props.radius), 0, 2 * Math.PI);
		ctx.stroke();
	};

	// This stuff should be on the outside
	let canvas = dom(["canvas", { width: width, height: height }]);
	let ctx = canvas.getContext("2d");

	memo(() => {
		ctx.clearRect(0, 0, width.value(), height.value());
		drawCircleFn(width.value() / 2, height.value() / 2)(ctx);
	}, [width, height, inputs]);

	return [canvas];
};

const rectRender = (node, inputs) => {
};

export const Circle = {
	id: "circle",
	render: circleRender,
	inputs: {
		x: V.number(Math.random() * 500),
		y: V.number(Math.random() * 500),
		radius: V.number(50),
		strokeWeight: V.number(1),
		fill: V.array([0, 0, 50, 15]),
		stroke: V.string("black"),
		// v.or(v.string('black'), v.array([0,0,0,100]))
	},
	outputs: {},
	transform: (props) => ({
		draw: ["Circle", props],
	}),
};
