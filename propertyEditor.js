import { memo, reactive } from "./chowk.js";
import { getNodeLocation, state, store } from "./state.js";

let selected = (i, address) => {
	let addy = [...address];
	if (i != undefined) addy.push(i);
	let addy_str = addy.join("-");
	return {
		address: addy_str,
		// selected: addy_str == cursor.value().join("-"),
		// onclick: (e) => {
		// 	e.stopImmediatePropagation()
		// 	e.stopPropagation()
		// 	// cursor.next([...addy])
		// }
	};
};
let defaultrenderer = (el, a, i, change) => {
	let concated = i != undefined ? a.concat([i]) : a;
	if (Array.isArray(el)) return arrayui(el, concated);
	else if (typeof el == "object") return objectui(el, concated);
	else if (typeof el == "function") return ["span.function", "FN"];
	else if (typeof el == "string") {
		return string(el, a, i);
	} else if (typeof el == "number") {
		return number(el, a, i);
	} else console.error(el);
};

let number = (el, a, i) => {
	return ["input.number", {
		...selected(i, a),
		type: "number",
		value: parseFloat(el).toFixed(2),
		oninput: (e) => {
			let num = parseFloat(e.target.value);
			if (typeof num == "number") {
				let location;
				if (i != undefined) location = [...a];
				else {
					location = [location.slice(0, -1)];
					i = location[location.length - 1];
				}
				store.tr(location, "set", [i, num]);
			}
		},
	}, parseFloat(el).toFixed(1) + ""];
};

let string = (el, a, i) => {
	return ["textarea.number", {
		...selected(i, a),
		oninput: (e) => {
			let num = e.target.value;
			if (typeof num == "string") {
				let location;
				if (i != undefined) location = [...a];
				else {
					location = [location.slice(0, -1)];
					i = location[location.length - 1];
				}
				store.tr(location, "set", [i, num]);
			}
		},
	}, el];
};

export let objectui = (object, address = [], renderer = defaultrenderer) => {
	// change should manage the resetting back of the rendere
	let change = (r) => renderer = r;
	let f = Object.entries(object).map(([key, value], i) => {
		return [
			".property",
			["span.key", key],
			renderer(value, address, key, change),
		];
	});

	return [".object", {
		tabindex: 0,
		...selected(address[address.length - 1], address.slice(0, -1)),
	}, ...f];
};

export let arrayui = (arr, address = [], renderer = defaultrenderer) => {
	// change should manage the resetting back of the rendere
	let change = (r) => renderer = r;
	let f = arr.map((el, i) => {
		return renderer(el, address, i, change);
	});

	return [".array", {
		tabindex: 0,
		...selected(address[address.length - 1], address.slice(0, -1)),
	}, ...f];
};

let current = {
	"Ass": "titties",
	dawg: ["money", "bomb"],
};

let propertySelection = reactive(["data", "nodes"]);

export let propertybar = () => [
	".property-bar",
	{ open: state.propertybarOpen },
	memo(() =>
		defaultrenderer(
			store.get(propertySelection.value()),
			propertySelection.value(),
		), [propertySelection]),
];

state.selected.subscribe((e) => {
	if (e.length == 1) {
		propertySelection.next(getNodeLocation(e[0]));
	}
});

setTimeout(() => {
	propertySelection.next(["data", "nodes", 4]);
}, 500);

