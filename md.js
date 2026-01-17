import markdownIt from "./markdown-it/markdown-it.js"
import markdownItMark from "./markdown-it/markdown-it-mark.js"
import { moveToBlock } from "./script.js";
// import { moveToBlock } from "./script.js";

// ********************************
// SECTION : MARKDOWN RENDERING
// ********************************
// let md = new markdownIt('commonmark').use(markdownItMark);
let md = new markdownIt().use(markdownItMark);

let attrs = (item) => {
	let attrs = item.attrs;
	if (!attrs) return {}
	return Object.fromEntries(attrs);
};

export const link_is_block = (link) => {
	return link.includes("are.na/block");
};
export const extract_block_id = (link) => {
	return link.split("/").pop();
};


function eat(tree) {
	let ret = [];

	if (!tree) return "";

	while (tree.length > 0) {
		let item = tree.shift();
		if (item.nesting === 1) {
			let at = attrs(item);
			let ignore = false;
			if (at.href) at.target = '_blank'

			if (at.href && link_is_block(at.href)) {
				let id = extract_block_id(at.href);
				// at.href = undefined
				at.class = 'jump'
				item.tag = 'button'
				at.onclick = e => {
					e.preventDefault()
					moveToBlock(id)
				}
			}

			if(!ignore){
				let children = eat(tree);
				ret.push([item.tag, at, ...children])
			}
		}
		if (item.nesting === 0) {
			if (!item.children || item.children.length === 0) {
				let p = item.type === "softbreak"
					? ["br"]
					: item.type === "fence"
						? ["pre", item.content]
						: item.type === 'code_inline'
						? [item.tag, item.content] :
						item.content;
				ret.push(p);
			} else {
				let children = eat(item.children);
				children.forEach(e => ret.push(e))
			}
		}

		if (item.nesting === -1) break;
	}

	return ret;
}

let safe_parse = (content) => {
	try {
		return md.parse(content, { html: true });
	} catch (e) {
		return undefined;
	}
};

let debug_print = false
export const MD = (content) => {
	let tree, body;
	tree = safe_parse(content);
	if (tree) body = eat(tree);
	else body = content;
	return body;
};
