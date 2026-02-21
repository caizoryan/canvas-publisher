import { dom } from "./dom.js";
import { memo, reactive } from "./chowk.js";
import { get_channel, try_auth } from "./arena.js";
import { notificationpopup } from "./notification.js";
import { mountContainer } from "./script.js";
import { unwrap } from "./block.js";
import { createStore } from "./store.js";
import { svgline, svgrect, svgrectnormal } from "./svg.js";
import { dragTransforms } from "./dragOperations.js";
import { mountBoundingBox } from "./bigBoundingBox.js";
import { createRegistery } from "./registery.js";
import {
	add,
	ApplyFunction,
	CollectObjects,
	colorSliders,
	CompileObject,
	CreateFunction,
	CreateVariable,
	Grid,
	LineEditor,
	LogObject,
	MathComps,
	NamedObject,
	Number,
	ObjectLabeller,
	ReadVariable,
	ReturnObject,
	Slider,
	Slider2D,
	String,
} from "./components/utils.js";
import { physariumCanvas, renderCanvas, renderPDFCanvas } from "./canvas.js";
import { V } from "./schema.js";

import { Circle, ImageElement, Line, Text } from "./components/shapes.js";

let stringify = JSON.stringify;
export let mouse = reactive({ x: 0, y: 0 });
export let state = {
	authSlug: reactive(""),
	authKey: undefined,
	me: {},

	// 'connect' | 'resize'
	mode: reactive("pan"),

	sidebarOpen: reactive(false),
	helpOpen: reactive(false),
	making_node: "circle",

	recentSlugs: reactive([]),
	currentSlug: reactive("are-na-canvas"),
	selected: reactive([]),
	selectedConnection: reactive([]),
	// could make this to make multiple pins
	pinnedNode: reactive(0),

	containerMouseX: reactive(0),
	containerMouseY: reactive(0),

	block_connection_buffer: undefined,
	selected_connection: undefined,
	connectionFromX: reactive(0),
	connectionFromY: reactive(0),
	connectionToX: reactive(0),
	connectionToY: reactive(0),

	updated: reactive(false),
	canvasX: reactive(0),
	canvasY: reactive(0),
	canvasScale: reactive(1),

	dimensions: reactive(100000),
	holdingCanvas: reactive(false),
	canceled: reactive(false),

	trackpad_movement: true,
	last_history: [],
	dot_book: undefined,
	moving_timeout: undefined,

	reRenderEdges: reactive(0),
};

// subscribe to currentSlug to update url
state.currentSlug.subscribe((slug) => history.pushState("", "", "#" + slug));

export let store = createStore({
	data: { nodes: [], edges: [] },
	nodeHash: {},
	buffers: {},
	edgeMap: {},
	// will be stored as {[name] : {value, sourceId}}
	variables: {},
});

function makeLineArrowMarker(
	size = 1,
	id = "arrow",
	color = "black",
	strokeWidth = 2,
) {
	const box = 10 * size;
	const cx = box;
	const cy = box / 2;
	const arm = 4 * size;

	return [
		"defs",
		{},
		[
			"marker",
			{
				id,
				markerWidth: box + 5 * size,
				markerHeight: box + 5 * size,
				refX: cx,
				refY: cy,
				orient: "auto",
				markerUnits: "strokeWidth",
			},
			[
				"path",
				{
					d: `
            M ${cx - arm} ${cy - arm}
            L ${cx} ${cy}
            L ${cx - arm} ${cy + arm}
          `,
					stroke: color,
					strokeWidth,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					fill: "none",
				},
			],
		],
	];
}

function makeXMarker(size = 1, id = "x", color = "black", strokeWidth = 2) {
	const box = 10 * size;
	const pad = 2 * size;

	return [
		"defs",
		{},
		[
			"marker",
			{
				id,
				markerWidth: box,
				markerHeight: box,
				refX: box / 2,
				refY: box / 2,
				orient: "auto",
				markerUnits: "strokeWidth",
			},
			[
				"path",
				{
					d: `
            M ${pad} ${pad}
            L ${box - pad} ${box - pad}
            M ${box - pad} ${pad}
            L ${pad} ${box - pad}
          `,
					stroke: color,
					strokeWidth,
					strokeLinecap: "round",
					fill: "none",
				},
			],
		],
	];
}

export let registery = createRegistery();
registery.register(
	"canvas",
	{
		draw: V.array().collect(),
	},
	{},
	renderCanvas,
	(props) => {
		return { draw: ["Group", props] };
	},
);

registery.register(
	"physariumCanvas",
	{
		x: V.number(0),
		y: V.number(0),
		draw: V.array().collect(),
	},
	{},
	physariumCanvas,
	(props) => {
		let drawables = props.draw;
		return { draw: ["Group", { draw: drawables }] };
	},
);

registery.register(
	"pdfCanvas",
	{
		draw: V.array().collect(),
	},
	{},
	renderPDFCanvas,
	(props) => {
		return { draw: ["Group", props] };
	},
);

registery.register(Circle);
registery.register(String);
registery.register(ImageElement);
registery.register(LogObject);
registery.register(Text);
registery.register(Grid);
registery.register(ObjectLabeller);
registery.register(MathComps.add);
registery.register(MathComps.sub);
registery.register(MathComps.mul);
registery.register(Slider);
registery.register(Slider2D);
registery.register(CreateFunction);
registery.register(CreateVariable);
registery.register(ReadVariable);
registery.register(CompileObject);
registery.register(ReturnObject);
registery.register(ApplyFunction);
registery.register(Number);
registery.register(CollectObjects);
registery.register(Line);
registery.register(LineEditor);
registery.register(NamedObject);

registery.register(
	"colorSliders",
	{
		c: V.number(0),
		m: V.number(0),
		y: V.number(0),
		k: V.number(0),
	},
	{},
	colorSliders,
	(props) => {
		const o = {
			fill: [props.c, props.m, props.y, props.k],
		};
		return o;
	},
);

store.subscribe(["data", "nodes"], (e) => {
	// because we said children updates are true,
	// then it will check what in children was updated and pass that as a ref
	state.updated.next(false);

	let yes = false;
	if (e.id) {
		// check if e.id is in edges
		store.get(EDGES).forEach((n) => {
			if (n.fromNode == e.id || n.toNode == e.id) {
				yes = true;
			}
		});
	}
	if (yes) state.reRenderEdges.next((e) => e + .0001);
}, true);

// ~~~~~~~~~~~
// STORE UTILS
// ~~~~~~~~~~~
export let NODES = ["data", "nodes"];
export let EDGES = ["data", "edges"];
export let NODEHASH = ["data", "nodeHash"];
export let NODEAT = (i) => NODES.concat([i]);

store.subscribe(EDGES, () => state.reRenderEdges.next((e) => e + .0001));
store.subscribe(NODES, () => updateBuffers());
store.subscribe(EDGES, () => updateBuffers());

// from(s)
export let BUFFERS = ["buffers"];

// will be storeds as {[blockid(from)] : [{edgeId, blockId(to)}]}
// to(s)
export let EDGEMAP = ["edgeMap"];

export let updateNodeHash = () => {
	let oldHash = store.get(NODEHASH);
	let hash = store.get(NODES)
		.reduce((acc, n, i) => (acc[n.id] = NODEAT(i), acc), {});

	if (oldHash) {
		Object.entries(oldHash).forEach(([key, value]) => {
			if (!idSubscriptions[key]) return;
			let { remove, fns, location } = idSubscriptions[key];

			if (!hash[key]) {
				remove();
				delete idSubscriptions[key];
			} else if (stringify(value) != stringify(hash[key])) {
				fns.forEach((fn) => {
					idSubscriptions[key].remove = store.relocate(location, hash[key], fn);
				});
				idSubscriptions[key].location = hash[key];
			}
		});
	}

	store.tr(["data"], "set", ["nodeHash", hash], false);
};
let idSubscriptions = {};

export let subscribeToId = (id, location, fn) => {
	let l = getNodeLocation(id);
	let remove = store.subscribe(l.concat(location), fn);
	if (idSubscriptions[id]) idSubscriptions[id].fns.push([fn]);
	idSubscriptions[id] = { fns: [fn], location, remove };
};

export let addEdgeMap = (id) => {
	store.tr(EDGEMAP, "set", [id, []], false);
};

export let addBuffer = (id) => {
	store.tr(BUFFERS, "set", [id, {}], false);
};
export let removeBuffer = (id) => {
	// just set to undefined
	store.tr(BUFFERS, "set", [id, undefined], false);
};

export let setNodes = (nodes) => {
	store.tr(["data"], "set", ["nodes", nodes], false);
	store.clearHistory();
	updateNodeHash();
};
export let addNode = (node) => {
	store.tr(NODES, "push", node, false);
	updateNodeHash();

	setTimeout(() => {
		// this can be called like a mount or smth?
		// will check if data is initialized, if not will do that
		//
		let el = registery.mount(node);
		if (el) document.querySelector(".container").appendChild(el);
	}, 10);
};
export let removeNode = (nodeId) => {
	let index = store.get(NODES).findIndex((e) => e.id == nodeId);
	if (index != -1) {
		store.apply(NODES, "remove", [index, 1], false);
	}

	// delete also since add node adds it
	// if (el) document.querySelector('.container').appendChild(el)
	updateNodeHash();
};

export let addEdge = (edge) => {
	// check if connection already exists
	// if not then add
	let exists = false;
	store.get(EDGES).forEach((e) => {
		if (exists) return;
		if (
			e.fromNode == edge.fromNode &&
			e.fromSide == edge.fromSide &&
			e.toSide == edge.toSide &&
			e.toNode == edge.toNode
		) exists = true;
	});

	if (!exists) {
		addBuffer(edge.id);
		store.tr(EDGES, "push", edge);
		mountEdge(edge);
		// state.reRenderEdges.next((e) => e + .0001);
	} else notificationpopup("Connection Already Exists", true);
};

let mountEdge = (edge) => {
	let from = R(getNodeLocation(edge.fromNode), edge.fromNode);
	let to = R(getNodeLocation(edge.toNode), edge.toNode);

	if (!(from && to)) return;

	let selectionColor = memo(() => {
		let ret = state.selected.value().reduce((acc, f) => {
			if (acc != "#ddd4") {
				return acc;
			} else {
				if (edge.fromNode == f) return "#88f";
				else if (edge.toNode == f) return "#f8f";
				else return acc;
			}
		}, "#ddd4");
		return ret;
	}, [state.selected]);

	let fromT = memo(() => boundingToSide(from.value(), edge.fromSide), [from]);
	let toT = memo(() => boundingToSide(to.value(), edge.toSide), [to]);

	let x1 = memo(() => fromT.value().x, [fromT]);
	let y1 = memo(() => fromT.value().y, [fromT]);

	let x2 = memo(() => toT.value().x, [toT]);
	let y2 = memo(() => toT.value().y, [toT]);

	let el = ["line", {
		selected: memo(() => state.selectedConnection.value().includes(edge.id), [
			state.selectedConnection,
		]),
		x1,
		y1,
		x2,
		y2,
		stroke: selectionColor,
		"marker-start": "url(#x)",
		"marker-end": "url(#arrow)",
		"stroke-width": 3,
		id: "edge-" + edge.id,
		class: "connection-line",
		// onpointerdown: (event) => {
		// 	if (event.shiftKey) {
		// 		state.selectedConnection.next((a) => [...a, e.id]);
		// 	} else state.selectedConnection.next([e.id]);
		// },
	}];

	setTimeout(() => {
		document.querySelector("svg.background").appendChild(dom(el));
	}, 10);
};

export let removeEdge = (edgeId) => {
	let index = store.get(EDGES).findIndex((e) => e.id == edgeId);
	if (index != -1) {
		store.apply(EDGES, "remove", [index, 1]);
		let edge = document.querySelector("#edge-" + edgeId);
		if (edge) edge.remove();
	}
};

export let updateBuffers = () => {
	// everytime nodes or edges change check if new nodes exist
	// if new node exists then add a buffer for it

	// for syncing (adding and deleting)
	let dontExistBuffers = Object.keys(store.get(BUFFERS));

	let edgeIds = Object.keys(store.get(EDGES));
	let edges = store.get(EDGES);
	let nodes = store.get(NODES);
	let edgeMap = store.get(EDGEMAP);
	let dontExistEdgeMap = Object.keys(edgeMap);

	// -------------------
	// Buffers sync (From (inputs))
	// -------------------
	nodes.forEach((node) => {
		if (dontExistBuffers.includes(node.id)) {
			dontExistBuffers = dontExistBuffers.filter((e) => e != node.id);
			return;
		} else {
			addBuffer(node.id);
		}
	});

	// ----------------------------
	// Edgemap sync (Tos (outputs))
	// ----------------------------
	nodes.forEach((node) => {
		// if doesn't in edgemap add
		if (dontExistEdgeMap.includes(node.id)) {
			dontExistEdgeMap = dontExistEdgeMap.filter((e) => e != node.id);
			return;
		} else {
			addEdgeMap(node.id);
		}
	});

	Object.entries(edgeMap).forEach(([id, nodes]) => {
		let toRemove = [];
		let blockIdToRemove = [];
		nodes.forEach(({ edgeId, blockId }) => {
			// check if edge still exists
			if (edgeIds.includes(edgeId)) {
				// do nothing
			} else {
				// mark this entry to be removed
				toRemove.push(edgeId);
				blockIdToRemove.push(blockId);

				// delete blockId's id
			}
		});

		let newLocations = nodes.filter((f) => !(toRemove.includes(f.edgeId)));
		store.apply(EDGEMAP, "set", [id, newLocations], false);
		blockIdToRemove.forEach((blockId) => {
			store.apply(BUFFERS.concat([blockId]), "set", [id, undefined], false);
		});

		// also delete values from from
	});

	edges.forEach((edge) => {
		let from = store.get(EDGEMAP.concat(edge.fromNode));

		let found = from.findIndex((e) => e.edgeId == edge.id);
		if (found == -1) {
			store.apply(EDGEMAP.concat(edge.fromNode), "push", {
				edgeId: edge.id,
				blockId: edge.toNode,
			}, false);
		}
	});

	// if node is deleted delete its subscribers from the store
	// and delete its buffer
	// dontExistBuffers.forEach(e =>
	// 	removeBuffer(e)
	// )
};

export let getNodeLocation = (id) => store.get(NODEHASH)[id];

// ~~~~~~~~~~~---------
// Initialize local storage
// ~~~~~~~~~~~---------
function load_local_storage() {
	// let local_currentslug = localStorage.getItem("slug")
	// if (local_currentslug) state.current_slug = local_currentslug

	let a = localStorage.getItem("auth");
	if (a) {
		state.authKey = a;
		try_auth();
	}

	let s = localStorage.getItem("recent-slugs");
	if (s) state.recentSlugs.next(JSON.parse(s));

	let t = localStorage.getItem("transform");
	if (t) {
		t = JSON.parse(t);
		state.canvasX.next(t.x);
		state.canvasY.next(t.y);
		state.canvasScale.next(t.scale);
	} else t = { x: 0, y: 0, scale: 1 };
}
load_local_storage();

// ~~~~~~~~~~~---------
// Are.na Functions
// ~~~~~~~~~~~---------
export let try_set_channel = (slugOrURL) => {
	// TODO: Add more safety here?
	let isUrl = slugOrURL.includes("are.na/");
	if (isUrl) {
		let slug = slugOrURL.split("/").filter((e) => e != "").pop();
		set_channel(slug);
	} else {
		set_channel(slugOrURL.trim());
	}
};
let set_channel = (slug) => {
	notificationpopup("Loading " + slug + "...");
	get_channel(slug)
		.then((res) => {
			if (!res.data) {
				notificationpopup([
					"span",
					"Failed to get channel " + slug,
					" try refreshing or opening another channel",
				], true);
			} else {
				notificationpopup("Loaded Channel: " + slug);
				notificationpopup("Total Blocks: " + res.data.length);

				state.currentSlug.next(slug);
				updateData(res.data);

				let svg = svgBackground();

				mountContainer([
					// ...groups.map(GroupElement),
					svg,
					mountBoundingBox(),
					// ...blocks.map(BlockElement),
				]);
			}
		});
};

let x1 = dragTransforms.startX;
let x2 = dragTransforms.endX;
let y1 = dragTransforms.startY;
let y2 = dragTransforms.endY;
let rectx = memo(() => Math.min(unwrap(x1), unwrap(x2)) || 0, [x1, x2]);
let recty = memo(() => Math.min(unwrap(y1), unwrap(y2)) || 0, [y1, y2]);
let rectheight = memo(() => Math.abs(unwrap(y2) - unwrap(y1)) || 0, [y1, y2]);
let rectwidth = memo(() => Math.abs(unwrap(x2) - unwrap(x1)) || 0, [x1, x2]);

let dragMarker = dom(svgrectnormal(
	rectx,
	recty,
	rectwidth,
	rectheight,
	memo(
		() =>
			(state.holdingCanvas.value() || state.canceled.value())
				? "#fff1"
				: "#0008",
		[state.holdingCanvas, state.canceled],
	),
	4,
	{
		onclick: (e) => {
			console.log(e);
			if (e.altKey) {
				console.log("ALT KEY");
			}
		},
	},
));

let R = (location) => ({
	isReactive: true,
	value: () => store.get(location),
	subscribe: (fn) => store.subscribe(location, fn),
});

export let boundingToSide = (b, side) => {
	let s = 10;
	if (side == "top") {
		return ({
			x: b.x + b.width / 2,
			y: b.y - s,
		});
	}

	if (side == "bottom") {
		return ({
			x: b.x + b.width / 2,
			y: b.y + b.height + s,
		});
	}

	if (side == "right") {
		return ({
			x: b.x + b.width + s,
			y: b.y + b.height / 2,
		});
	}

	if (side == "left") {
		return ({
			x: b.x - s,
			y: b.y + b.height / 2,
		});
	}
};

state.selected.subscribe(() => {
	state.reRenderEdges.next((e) => e + 1);
});

let currentConnection = svgline(
	state.connectionFromX,
	state.connectionFromY,
	state.connectionToX,
	state.connectionToY,
	"#0008",
	8,
	12,
);

let svgBackground = () => {
	return [
		"svg.background",
		{ width: state.dimensions, height: state.dimensions },
		makeLineArrowMarker(.4, "arrow", "#222"),
		makeXMarker(.4),
		currentConnection,
		dragMarker,
	];
};

let updateData = (blocks) => {
	setNodes([]);
	state.dot_book = blocks.find((e) => e.title == ".book");
	if (state.dot_book) {
		let parsed = JSON.parse(state.dot_book.content.plain);
		store.pauseTracking();
		parsed.nodes.forEach((f) => addNode(f));
		parsed.edges.forEach((f) => addEdge(f));
		updateNodeHash();
		store.resumeTracking();

		// if data has blocks that aren't in blocks... remove them
		// let updateHash = false
		// store.get(NODES).forEach(node => {
		// 	if (node.type == 'group') return
		// 	let f
		// 	if (node.id.toString().charAt(0) == 'c')
		// 		f = blocks.find(e => 'c'+e.id == node.id)
		// 	else f = blocks.find(e => e.id == node.id)
		// 	if (!f) {
		// 		console.log('removing')
		// 		let i = store.get(NODES).findIndex(n => n == node)
		// 		store.tr(NODES, 'remove', [i, 1], false)
		// 		updateHash = true
		// 	}
		// })
		// let removeEdges = []
		// store.get(EDGES).forEach(node => {
		// 	let toTest = node.fromNode
		// 	let f
		// 	if (toTest.toString().charAt(0) == 'c')
		// 		f = blocks.find(e => 'c'+e.id == toTest)
		// 	else f = blocks.find(e => e.id == toTest)
		// 	if (!f) {removeEdges.push(node)}
		// })
		// store.get(EDGES).forEach(node => {
		// 	let toTest = node.toNode
		// 	let f
		// 	if (toTest.toString().charAt(0) == 'c')
		// 		f = blocks.find(e => 'c'+e.id == toTest)

		// 	else f = blocks.find(e => e.id == toTest)
		// 	if (!f) {removeEdges.push(node)}
		// })

		// removeEdges.forEach(node => {
		// 		console.log('removing edge')
		// 		let i = store.get(EDGES).findIndex(n => n == node)
		// 		store.tr(EDGES, 'remove', [i, 1], false)
		// 		updateHash = true
		// })

		// // will relocate
		// if (updateHash){
		// 	state.reRenderEdges.next(e => e+.00001)
		// 	updateNodeHash()
		// }
	} else {
		console.log("DIDNT FIND DOT BOOK");
		// let nodes = blocks.filter(e => e.title != ".book")
		// 		.map(constructBlockData)

		// setNodes(nodes)
	}
};

memo(() => {
	state.canvasScale.value() < 0.1 ? state.canvasScale.next(.1) : null;
	state.canvasScale.value() > 2.3 ? state.canvasScale.next(2.3) : null;

	localStorage.setItem(
		"transform",
		JSON.stringify({
			x: state.canvasX.value(),
			y: state.canvasY.value(),
			scale: state.canvasScale.value(),
		}),
	);
}, [state.canvasX, state.canvasY, state.canvasScale]);
