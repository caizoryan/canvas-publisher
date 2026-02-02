import {
	BUFFERS,
	getNodeLocation,
	state,
	store,
	subscribeToId,
} from "../state.js";

export let addToSelection = (block, e) => {
	if (e.shiftKey) state.selected.next((e) => [...e, block.id]);
	else state.selected.next([block.id]);
};

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

export let getProps = (id) => store.get(getNodeLocation(id).concat(["data"]));

const mapRange = (value, inMin, inMax, outMin, outMax) =>
	(value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
