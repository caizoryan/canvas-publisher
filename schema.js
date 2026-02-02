const any = (v) => {
	const root = {
		collects: false,
		collect: () => {
			root.collects = true;
			root.default = root.default == undefined ? [] : [root.default];
			return root;
		},
		default: v,
		check: () => true,
	};

	return root;
};

const number = (def = 1) => {
	let root = any();
	root.default = def;
	root.check = (v) => typeof v == "number";

	return root;
};

const string = (def = "") => {
	let root = any();
	root.default = def;
	root.check = (v) => typeof v == "string";

	return root;
};

const array = (def = []) => {
	let root = any();
	root.default = def;
	root.check = (v) => Array.isArray(v);
	return root;
};

export const V = {
	number,
	string,
	array,
	any,
};
