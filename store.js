let stringify = JSON.stringify;
export let createStore = (internal) => {
	let undo = [];
	let redo = [];

	let doingRedo = false;
	let canUndo = () => undo.length > 0;
	let canRedo = () => redo.length > 0;

	let clearHistory = () => {
		while (redo.length != 0) redo.pop();
		while (undo.length != 0) undo.pop();
		onHistoryUpdate.forEach((fn) => fn());
	};

	let doUndo = () => {
		let old = tracking;
		tracking = "redo";
		let action = undo.pop();
		if (action) apply(...action);
		tracking = old;
	};

	let doRedo = () => {
		let old = tracking;
		doingRedo = true;
		tracking = "undo";
		let action = redo.pop();
		if (action) apply(...action);
		doingRedo = false;
		tracking = old;
	};

	let batch = [];
	let onHistoryUpdate = new Set();
	let subscribeHistory = (fn) => {
		onHistoryUpdate.add(fn);
		return () => onHistoryUpdate.delete(fn);
	};

	let recordInverse = (action) => {
		if (tracking == "undo") {
			if (!doingRedo) {
				while (redo.length != 0) {
					redo.pop();
				}
			}
			undo.push(action);
		} else if (tracking == "redo") {
			redo.push(action);
		} else if (tracking == "batch") {
			batch.push(action);
		}
	};

	let startBatch = () => {
		lastTracking = tracking;
		tracking = "batch";
	};

	let endBatch = () => {
		tracking = lastTracking;
		recordInverse(["batch", batch]);
		batch = [];
	};

	let relocate = (from, to, fn) => {
		// also relocate for children enabled
		let f = subscriptions.get(stringify(from));
		let i = -1;
		if (f) f.findIndex((e) => e == fn);
		if (i != i) f.splice(i, 1);

		return subscribe(to, fn);
	};

	let tracking = "undo";
	let lastTracking = tracking;

	let pauseTracking = () => tracking = "paused";
	let resumeTracking = () => tracking = "undo";

	let subscriptions = new Map();
	let childrenEnabled = new Map();
	let conditionalSubscription = new Map();

	let apply = (location, action, value, track = true) => {
		if (!track) pauseTracking();
		else if (typeof location == "string" && location == "batch") {
			startBatch();
			action.forEach((act) => apply(...act));
			endBatch();
			return;
		}

		let ref = getref(location, internal);
		if (action == "push") {
			ref.push(value);
			recordInverse([[...location], "pop"]);
		} else if (action == "pop") {
			let removed = ref.pop();
			recordInverse([[...location], "push", removed]);
		} else if (action == "insert") {
			ref.splice(value[0], 0, value[1]);
			recordInverse([[...location], "remove", [value[0], 1]]);
		} else if (action == "set") {
			let old = ref[value[0]];
			ref[value[0]] = value[1];

			let loc = location.concat([value[0]]);
			recordInverse([[...location], "set", [value[0], old]]);

			// figure out how to have this somehwer else...
			let subscribers = subscriptions.get(stringify(loc));
			if (subscribers) subscribers.forEach((fn) => fn(ref[value[0]]));

			let childSubscribers = childrenEnabled.get(stringify(loc));
			if (childSubscribers) childSubscribers.forEach((fn) => fn(ref[value[0]]));
		} else if (action == "remove") {
			// TODO: Make also work for objects (delete property)
			let [removed] = ref.splice(value[0], value[1]);
			recordInverse([[...location], "insert", [value[0], removed]]);
		}

		let subscribers = subscriptions.get(stringify(location));
		if (subscribers) subscribers.forEach((fn) => fn(ref));

		let childSubscribers = childrenEnabled.get(stringify(location));
		if (childSubscribers) childSubscribers.forEach((fn) => fn(ref));

		let tomatch = location;
		let under = [];
		childrenEnabled.forEach((v, k) => {
			// TODO: use this matcher pattern for children enabled stuff...
			let matcher = JSON.parse(k);
			if (tomatch.length <= matcher.length) return;
			let matched = matcher.reduce((acc, val, i) =>
				acc
					// if last was true check again
					? tomatch[i] == val ? true : false
					// if is false will be false
					: false, true);

			// if (matched) under.push(v)
			if (matched) under.push(v);

			// return dir files
			// everything under should go...
			return under;
		});
		under.forEach((fns) => fns.forEach((fn) => fn(ref)));

		if (!track) resumeTracking();
	};
	let get = (location) => getref(location, internal);
	let subscribe = (location, fn, children = false) => {
		// somehow make this nestable?
		// ['key', 'another'] subscription
		// should also notify ['key'] subscription
		// should notify parent basically
		let key = stringify(location);
		let map = subscriptions;

		if (children) {
			// then do something where each update checks if it is a child of
			// and if it is then calls this fn
			map = childrenEnabled;
		}

		let is = map.get(key);
		if (is) is.push(fn);
		else map.set(key, [fn]);
		return () => {
			let fns = map.get(key);
			let index = fns.find((e) => e == fn);
			if (index != -1) fns.splice(index, 1);
		};
	};
	let getref = (address, arr) => {
		let copy = [...address];
		let index = copy.shift();
		if (!arr) return undefined;
		if (copy.length == 0) return arr[index];
		return getref(copy, arr[index]);
	};
	return {
		apply,
		tr: apply,
		get,
		subscribe,
		startBatch,
		endBatch,
		doUndo,
		canUndo,
		doRedo,
		canRedo,
		pauseTracking,
		resumeTracking,
		relocate,
		clearHistory,
		undo,
		redo,
		subscribeHistory,
	};
};
