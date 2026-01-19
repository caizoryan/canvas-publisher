import { dom } from "./dom.js";
import { memo, reactive } from "./chowk.js";
import { get_channel, try_auth } from "./arena.js";
import { notificationpopup } from "./notification.js";
import { mountContainer } from "./script.js";
import {
	BlockElement,
	connectors,
	constructBlockData,
	GroupElement,
	unwrap,
} from "./block.js";
import { createStore } from "./store.js";
import { svgline, svgrect, svgrectnormal } from "./svg.js";
import { dragTransforms } from "./dragOperations.js";
import { mountBoundingBox } from "./bigBoundingBox.js";
import { createRegistery } from "./registery.js";
import { renderCanvas, renderCircle, renderNumberPropFn } from "./canvas.js";

let stringify = JSON.stringify;
export let mouse = reactive({ x: 0, y: 0 });

export let state = {
	authSlug: reactive(""),
	authKey: undefined,
	me: {},

	sidebarOpen: reactive(false),
	helpOpen: reactive(false),
	making_node: "circle",

	recentSlugs: reactive([]),
	currentSlug: reactive("are-na-canvas"),
	selected: reactive([]),

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

	dimensions: reactive(10000),
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
registery.register("canvas", {}, {}, renderCanvas);
registery.register("circle", {}, {}, renderCircle);
registery.register("x", {}, {}, renderNumberPropFn("x"));
registery.register("y", {}, {}, renderNumberPropFn("y"));
registery.register("strokeWeight", {}, {}, renderNumberPropFn("strokeWeight"));

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
	// TODO: Make removes...
	let remove = store.subscribe(l.concat(location), fn);
	if (idSubscriptions[id]) idSubscriptions[id].fns.push([fn]);
	idSubscriptions[id] = { fns: [fn], location, remove };
};

export let addEdgeMap = (id) => {
	store.tr(EDGEMAP, "set", [id, []]);
};

export let addBuffer = (id) => {
	store.tr(BUFFERS, "set", [id, {}]);
};
export let removeBuffer = (id) => {
	// just set to undefined
	store.tr(BUFFERS, "set", [id, undefined]);
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
		let el = registery.render(node);
		if (el) document.querySelector(".container").appendChild(el);
	}, 100);
};
export let removeNode = (node) => {
	let index = store.get(NODES).findIndex((e) => e.id == node.id);
	if (index != -1) store.apply(NODES, "remove", [index, 1], false);

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
		state.reRenderEdges.next((e) => e + .0001);
	} else notificationpopup("Connection Already Exists", true);
};
export let removeEdge = (edge) => {
	let index = store.get(EDGES).findIndex((e) => e.id == edge.id);
	if (index != -1) store.apply(EDGES, "remove", [index, 1]);

	state.reRenderEdges.next((e) => e + .0001);
};
export let updateBuffers = () => {
	console.log("ASS FUCKER FUCKKKKKK");
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
			console.log("Edge doesn't exist", node.id, dontExistEdgeMap);
			addEdgeMap(node.id);
		}
	});

	console.log("ASS GUCKER 2");
	Object.entries(edgeMap).forEach(([id, nodes]) => {
		console.log("ASS GUCKER 2.5", id, nodes.length, nodes);
		let toRemove = [];
		let blockIdToRemove = [];
		nodes.forEach(({ edgeId, blockId }) => {
			console.log("ASS GUCKER 3");
			// check if edge still exists
			if (edgeIds.includes(edgeId)) {
				// do nothing
				console.log("Edge still exists", edgeId, edgeIds);
			} else {
				console.log("Edge was removed", edgeId);
				// mark this entry to be removed
				toRemove.push(edgeId);
				blockIdToRemove.push(blockId);

				// delete blockId's id
			}
		});

		let newLocations = nodes.filter((f) => !(toRemove.includes(f.edgeId)));
		store.apply(EDGEMAP, "set", [id, newLocations]);
		blockIdToRemove.forEach((blockId) => {
			console.log("To removes: ", blockId);
			console.log("deleting", id, "from", blockId);
			store.apply(BUFFERS.concat([blockId]), "set", [id, undefined]);
			console.log(store.get(BUFFERS.concat([blockId, id])));
		});

		// also delete values from from
	});

	edges.forEach((edge) => {
		let from = store.get(EDGEMAP.concat(edge.fromNode));
		console.log("fromNode", edge.fromNode, from);

		let found = from.findIndex((e) => e.edgeId == edge.id);
		if (found == -1) {
			store.apply(EDGEMAP.concat(edge.fromNode), "push", {
				edgeId: edge.id,
				blockId: edge.toNode,
			});
			console.log(
				"Connected ",
				edge.fromNode,
				" to ",
				edge.toNode,
				store.get(EDGEMAP.concat(edge.fromNode)),
			);
		}
	});

	// if node is deleted delete its subscribers from the store
	// and delete its buffer
	// dontExistBuffers.forEach(e =>
	// 	removeBuffer(e)
	// )
	console.log(edgeMap);
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

				// let blocks = processBlockForRendering(res.data)
				// let groups = store.get(NODES).filter(e => e.type == 'group')
				let svg = svgBackground();
				// let els = store.get(NODES).map(registery)

				mountContainer([
					// ...groups.map(GroupElement),
					svg,
					mountBoundingBox(),
					// ...blocks.map(BlockElement),
				]);

				// addToRecents(slug)
				// setSlug(slug)
				// localStorage.setItem('slug', slug)
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
));

let R = (location) => ({
	isReactive: true,
	value: () => store.get(location),
	subscribe: (fn) => store.subscribe(location, fn),
});

let edges = memo(() => {
	if (!store.get(["data", "edges"])) return [];
	return store.get(["data", "edges"]).map((e) => {
		console.log("running");

		let boundingToSide = (b, side) => {
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

		let from = store.get(["data", "nodes"]).find((f) => f.id == e.fromNode);
		let to = store.get(["data", "nodes"]).find((f) => f.id == e.toNode);

		if (!(from && to)) return;
		// let to = store.get(getNodeLocation(e.toNode))

		let fromT = boundingToSide(from, e.fromSide);
		let toT = boundingToSide(to, e.toSide);

		return svgline(fromT.x, fromT.y, toT.x, toT.y, "black", 8, 0, {
			class: "connection-line",
			onmouseenter: () => {
				state.selected_connection = e;
			},
			onmouseexit: () => {
				state.selected_connection = undefined;
			},
		});
	}).filter((e) => e != undefined);
}, [
	R(["data", "edges"]),
	state.reRenderEdges,
]);

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
		edges,
	];
};

let updateData = (blocks) => {
	setNodes([]);
	state.dot_book = blocks.find((e) => e.title == ".book");
	if (state.dot_book) {
		let parsed = JSON.parse(state.dot_book.content.plain);
		parsed.nodes.forEach((f) => addNode(f));
		parsed.edges.forEach((f) => addEdge(f));
		updateNodeHash();

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
let processBlockForRendering = (blocks) => {
	blocks = blocks.filter((e) => e.title != ".book");
	return blocks;
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
