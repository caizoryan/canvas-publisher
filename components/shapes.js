import { getProps, R } from "./index.js";
import { getNodeLocation } from "../state.js";
import { dom } from "../dom.js";
import { V } from "../schema.js";
import { memo } from "../chowk.js";
import { dataR } from "../canvas.js";

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

function imageToUri(url, callback) {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	let base_image = new Image();
	base_image.crossOrigin = "anonymous";
	base_image.src = url;
	base_image.onload = function() {
		// low res
		if (canvas.width > 300 || canvas.height > 300) {
			canvas.width = base_image.width / 50;
			canvas.height = base_image.height / 50;
		} else {
			canvas.width = base_image.width;
			canvas.height = base_image.height;
		}

		ctx.drawImage(base_image, 0, 0, canvas.width, canvas.height);

		let url = canvas.toDataURL("image/png");
		callback(url);
	};
}

export let ImageRender = (node, ins, updateOut) => {
	let r = dataR(getNodeLocation(node.id), node.id);
	let key = r("src");
	let imageData = r("image");

	imageData.subscribe(() => {
		updateOut();
	});

	// TODO:
	// maybe set it up in such a way
	// that doc uses src to query an image library
	// and then doc controls the quality and stuff
	// and data is just a link rather than stringified entire image
	// and then if in current draw cycle, image isn't loaded,
	// it will just wait for next cycle
	let update = () => {
		imageToUri(key.value(), (v) => imageData.next(v));
	};

	key.subscribe(update);

	let el = ["input", {
		type: "text",
		value: key,
		oninput: (e) => {
			key.next(e.target.value.trim());
		},
	}];

	return [el, ["img", { src: key, style: "max-width: 90%; max-height: 90%;" }]];
};

export const Line = {
	id: "line",
	render: () => [dom(["span", "line"])],
	inputs: {
		points: V.array([{ x: 0, y: 0 }, { x: 100, y: 100 }]),
		stroke: V.string("black"),
		strokeWeight: V.number(5),
		// v.or(v.string('black'), v.array([0,0,0,100]))
	},
	outputs: {},
	transform: (props) => ({
		draw: ["Line", props],
	}),
};

export const Text = {
	id: "text",
	render: (node, i, updateOut) => {
		let r = dataR(getNodeLocation(node.id), node.id);
		let key = r("text");

		let text = dom(["textarea", {
			type: "text",
			oninput: (e) => {
				key.next(e.target.value.trim());
				updateOut();
			},
			value: key,
		}, key]);

		return [dom(["span", "Text"]), text];
	},
	inputs: {
		x: V.number(Math.random() * 500),
		y: V.number(Math.random() * 500),
		width: V.number(Math.random() * 500),
		height: V.number(Math.random() * 500),
		text: V.string("Hello world"),
		boundingBox: V.number(0),
		fontSize: V.number(12),
		fontFamily: V.string("Times-Roman"),
		fill: V.array([0, 0, 50, 15]),
		// stroke: V.string("black"),
		// v.or(v.string('black'), v.array([0,0,0,100]))
	},
	outputs: {},
	transform: (props) => ({
		draw: ["Text", props],
	}),
};

export const Group = {
	id: "text",
	render: () => [dom(["span", "Text"])],
	inputs: {
		draw: V.array([]).collect(),
		// stroke: V.string("black"),
		// v.or(v.string('black'), v.array([0,0,0,100]))
	},
	outputs: {},
	transform: (props) => ({
		draw: ["Group", props.draw],
	}),
};

export const ImageElement = {
	id: "image",
	render: ImageRender,
	inputs: {
		x: V.number(Math.random() * 500),
		y: V.number(Math.random() * 500),
		width: V.number(Math.random() * 500),
		src: V.string(""),
		image: V.string(""),
		// v.or(v.string('black'), v.array([0,0,0,100]))
	},
	outputs: {},
	transform: (props) => ({
		draw: ["Image", props],
	}),
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
