import { memo } from "./chowk.js";
import { dom } from "./dom.js";
import { addNode, removeEdge, state, store, try_set_channel } from "./state.js";
import { Keymanager } from "./keymanager.js";
import { sidebar } from "./sidebar.js";
import { dragOperations } from "./dragOperations.js";
import { notificationpopup } from "./notification.js";
import { add_block, add_link, connect_block, update_block } from "./arena.js";
import {
	BlockElement,
	button,
	constructBlockData,
	CSSTransform,
} from "./block.js";
import { helpbar } from "./help.js";
import { history } from "./history.js";
import { extract_block_id, link_is_block } from "./md.js";

// first order of business
// 1. Get canvas showing and moving like before
// 2. Load blocks from Are.na
// 3. Implement store
// 4. Add nodes to store
// 5. Render block

// -------------
// Utitlies
// ~~~~~~~~~~~~~
let checkSlugUrl = (url) => {
	if (!url.includes("#")) return;
	else return url.split("#").filter((e) => e != "").pop();
};

let downloadData = () => {
	let download_json = (json, file = "data") => {
		let a = document.createElement("a");

		json = JSON.stringify(json);
		console.log(json);
		let blob = new Blob([json], { type: "octet/stream" });
		let url = window.URL.createObjectURL(blob);

		a.href = url;
		a.download = file + ".book";
		a.click();
		window.URL.revokeObjectURL(url);
	};
	download_json(store.get(["data"]), state.currentSlug.value());
};

const link_is_url = (
	str,
) => (str.includes("http://") || str.includes("https://"));

let pasteInBlock = () => {
	navigator.clipboard.readText().then((res) =>
		res.split("\n").forEach((res) => {
			console.log(res, link_is_url(res));
			if (link_is_block(res)) {
				console.log("will connect block: ", extract_block_id(res), " to slug");
				connect_block(state.currentSlug.value(), extract_block_id(res))
					.then((block) => {
						console.log("BLock?", block);
						let newBlock = constructBlockData(block, {
							x: state.canvasX.value(),
							y: state.canvasY.value(),
							width: 350,
							height: 350,
						});
						addNode(newBlock);
						document.querySelector(".container").appendChild(
							BlockElement(block),
						);
					});
			} else if (link_is_url(res)) {
				add_link(state.currentSlug.value(), res.trim())
					.then((block) => {
						console.log("BLock?", block);
						let newBlock = constructBlockData(block, {
							x: state.canvasX.value(),
							y: state.canvasY.value(),
							width: 350,
							height: 350,
						});
						addNode(newBlock);
						document.querySelector(".container").appendChild(
							BlockElement(block),
						);
					});
			}
		})
	);
};

let copySelection = () => {
	let text = state.selected.value().map((e) => "https://are.na/block/" + e)
		.join("/n");

	console.log(text);
	navigator.clipboard.writeText(text);
};

// --------------------
// ACTIONS
// --------------------
const toggleTrackingMode = () =>
	state.trackpad_movement = !state.trackpad_movement;
const toggleSidebar = () => state.sidebarOpen.next((e) => !e);
const toggleHelpbar = () => state.helpOpen.next((e) => !e);
const removeCurrentEdge = () =>
	state.selected_connection ? removeEdge(state.selected_connection) : null;

const undo = () => store.canUndo() ? store.doUndo() : null;
const redo = () => store.canRedo() ? store.doRedo() : null;

const inc = (e = false) => e ? 250 : 120;
const zoomIn = () => state.canvasScale.next((f) => f + (inc() / 500));
const zoomOut = () => state.canvasScale.next((f) => f - (inc() / 500));
const moveLeft = () => state.canvasX.next((f) => f - inc());
const moveRight = () => state.canvasX.next((f) => f + inc());
const moveUp = () => state.canvasY.next((f) => f - inc());
const moveDown = () => state.canvasY.next((f) => f + inc());

const vistLast = () => {
	const last = state.last_history.pop();
	if (last) animateMove(last.x, last.y);
};

const escape = () => {
	state.canceled.next(true);
	state.selected.next([]);
};

const saveCanvasToArena = () => {
	const content = JSON.stringify(store.get(["data"]));
	if (state.dot_book?.id) {
		const description =
			`This block was made using [Are.na Canvas](http://canvas.a-p.space). You can view this channel as a canvas [here](http://canvas.a-p.space/#${state.currentSlug.value()})`;
		update_block(state.dot_book.id, { content, title: ".book", description })
			.then((res) => {
				if (res.status == 204) {
					notificationpopup("Updated 👍");
					state.updated.next(true);
				} else if (res.status == 401) {
					notificationpopup("Failed: Unauthorized :( ", true);
				} else notificationpopup("Failed :( status: " + res.status, true);
			});
	} else {
		add_block(state.currentSlug.value(), ".book", content).then((res) => {
			if (res.status == 204) {
				window.location.reload();
				// for now jsut refresh, butt todo later:
				// fetch from v3 api so get the content.plain and then make that dotcanvas.
				// make this the dotcanvas
			}
		});
	}
};

// ---------------------
// Main Buttons
// ~~~~~~~~~~~~~~~~~~~~~

export const CSSTransformNoUnit = (x, y, width, height) => {
	const v = `
		position: absolute;
		left: ${x};
		top: ${y};`;

	if (width != undefined) v += `width: ${width};`;
	if (height != undefined) v += `height: ${height};`;

	return v;
};

const openbtn = button(["span", "SIDEBAR ", ["code", "⌘E"]], toggleSidebar);
const savebtn = button(["span", "SAVE ", ["code", "⌘S"]], saveCanvasToArena, {
	updated: state.updated,
});

const helpbtn = button(
	["span", "HELP ", ["code", "?"]],
	() => state.helpOpen.next((e) => !e),
);

const buttons = [".main-buttons", savebtn, openbtn, helpbtn, history()];

// --------------------
// Move this somewhere
// xxxxxxxxxxxxxxxxxxxxx
export function moveToBlock(id) {
	let found = document.querySelector("*[block-id='" + id + "']");
	if (found) {
		if (state.moving_timeout) clearTimeout(state.moving_timeout);
		let { x, y, width, height } = found.getBoundingClientRect();
		let xDist = x - 150;
		let yDist = y - 150;

		if (width < window.innerWidth) {
			let left = (window.innerWidth - width) / 2;
			xDist = x - left;
		}

		// if visible don't move
		if (
			!(x > 0 && x + width < window.innerWidth) ||
			!(y > 0 && y + 150 < window.innerHeight)
		) {
			let last = {};
			last.x = state.canvasX.value();
			last.y = state.canvasY.value();

			state.last_history.push(last);

			let destX = (xDist / state.canvasScale.value()) + last.x;
			let destY = (yDist / state.canvasScale.value()) + last.y;

			animateMove(destX, destY);
		}

		let c = found.style.backgroundColor;
		let z = found.style.zindex;
		found.style.backgroundColor = "yellow";
		found.style.zIndex = 99;
		setTimeout(() => {
			found.style.backgroundColor = c;
			found.style.zIndex = z;
		}, 800);
	} else {
		notificationpopup(
			["span", "Block not found, ", ["a", {
				href: "https://are.na/block/" + id,
				target: "_blank",
			}, "jump to link"], "?"],
		);
	}
}

// --------------
// Animation
// --------------
const lerp = (start, stop, amt) => amt * (stop - start) + start;
const InOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
let animateMove = (destX, destY) => {
	let last = {};
	last.x = state.canvasX.value();
	last.y = state.canvasY.value();

	let t = 0;
	let v = 0;
	let progress = () => {
		t += .03;
		v = InOutQuad(t);
		state.canvasX.next(lerp(last.x, destX, v));
		state.canvasY.next(lerp(last.y, destY, v));
		if (t > .99) return;
		state.moving_timeout = setTimeout(progress, 1000 / 60);
	};
	progress();
};

// -------------
// Mounters
// -------------
export let mount = () => {
	let url = location.href;
	let slug = checkSlugUrl(url);
	slug ? try_set_channel(slug) : try_set_channel(state.currentSlug.value());

	document.body.appendChild(dom(helpbar));
	document.body.appendChild(dom(sidebar));
	document.body.appendChild(dom(buttons));
};

let unmountContainer = () => {
	let exists = document.querySelector(".container");
	if (exists) exists.remove();
};
export let mountContainer = (children) => {
	unmountContainer();

	// CSS transforms
	// ~~~~~~~~~~~~~~~~~~~~
	let stylemmeo = memo(() => `
		transform-origin:
			${state.canvasX.value() + window.innerWidth / 2}px
			${state.canvasY.value() + window.innerHeight / 2}px;

		transform:
				translate(
						${state.canvasX.value() * -1}px,
						${state.canvasY.value() * -1}px)
				scale(${state.canvasScale.value()});`, [
		state.canvasX,
		state.canvasY,
		state.canvasScale,
	]);

	// cursor
	// ~~~~~~~
	let cursor = [".cursor", {
		style: memo(() =>
			CSSTransform(
				state.containerMouseX.value(),
				state.containerMouseY.value(),
				15,
				15,
			), [state.containerMouseX, state.containerMouseY]),
	}];

	// DOM
	// ~~~~
	let root = dom([".container", {
		holding: state.holdingCanvas,
		style: stylemmeo,
		onpointerdown,
		onpointermove,
		onpointerup,
		...dragOperations,
	}, ...children]);

	root.onmousemove = (e) => {
		if (e.target != root) return;
		state.containerMouseX.next(e.offsetX);
		state.containerMouseY.next(e.offsetY);

		if (state.block_connection_buffer) {
			state.connectionToY.next(e.offsetY);
			state.connectionToX.next(e.offsetX);
		}
	};

	// ---------
	// MOUNT
	// ~~~~~~~~~
	document.body.appendChild(root);
	// ---------
};
// ---------------
// Data Logic
// ---------------
// Processing blocks
// Updating data
// Constructing data
// setting slug
// pulling from are.na

// ---------------
// Nodes
// ---------------
// x
// y
// scale
// minimap

// ---------------
// Buttons
// ---------------
// help
// save
// sidebar

// ---------------
// event listeners
// ---------------
// keydown
// wheel
// drag and drop

// -------------------
// Wheel Event (!)
// ~~~~~~~~~~~~~~~~~~~
document.addEventListener("wheel", (e) => {
	if (e.ctrlKey) {
		// trackpad...
		e.preventDefault();
		state.canvasScale.next((f) => f - (e.deltaY / 800));
	} else if (e.metaKey) {
		e.preventDefault();
		state.canvasScale.next((f) => f - (e.deltaY / 2500));
	} else if (state.trackpad_movement) {
		e.preventDefault();
		state.canvasY.next((f) => f + e.deltaY);
		state.canvasX.next((f) => f + e.deltaX);
	}
}, { passive: false });

let keys = new Keymanager();
let prevent = { preventDefault: true };

keys.on("cmd + z", undo, prevent);
keys.on("cmd + shift + z", redo, prevent);
keys.on("cmd + =", zoomIn, prevent);
keys.on("cmd + -", zoomOut, prevent);

keys.on("ArrowRight", moveRight, { disable_in_input: true });
keys.on("ArrowLeft", moveLeft, { disable_in_input: true });
keys.on("ArrowUp", moveUp, { disable_in_input: true });
keys.on("ArrowDown", moveDown, { disable_in_input: true });

keys.on("cmd + e", toggleSidebar, prevent);
keys.on("alt + cmd + c", toggleSidebar, prevent);
keys.on("escape", escape, { modifiers: false, disable_in_input: true });
keys.on("b", vistLast, { modifiers: false, disable_in_input: true });
keys.on("t", toggleTrackingMode, { disable_in_input: true });

//TEMPORARAY
keys.on("x", () => state.making_node = "x", {
	modifiers: false,
	disable_in_input: true,
});
keys.on("y", () => state.making_node = "y", {
	modifiers: false,
	disable_in_input: true,
});
keys.on("c", () => state.making_node = "circle", {
	modifiers: false,
	disable_in_input: true,
});
keys.on("s", () => state.making_node = "canvas", {
	modifiers: false,
	disable_in_input: true,
});

keys.on("w", () => state.making_node = "strokeWeight", {
	modifiers: false,
	disable_in_input: true,
});

keys.on("cmd + s", saveCanvasToArena, prevent);
keys.on("shift + /", toggleHelpbar, { disable_in_input: true });
keys.on("cmd + v", pasteInBlock, {
	disable_in_input: true,
	preventDefault: true,
});

keys.on("cmd + c", copySelection, {
	disable_in_input: true,
	preventDefault: true,
});

keys.on("cmd + d", downloadData, {
	disable_in_input: true,
	preventDefault: true,
});
keys.on("backspace", removeCurrentEdge, { disable_in_input: true, ...prevent });

document.onkeydown = (e) => keys.event(e);

// --------------------
// Hash watcher
// --------------------
window.onhashchange = (event) => {
	let slug = checkSlugUrl(event.newURL);
	if (slug) try_set_channel(slug);
};
// -------------------
// Initialization FN
// -------------------
mount();
