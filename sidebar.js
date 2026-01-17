import { reactive, memo } from "./chowk.js"
import { dom } from "./dom.js"
import { state, try_set_channel } from "./state.js"
import { try_auth } from "./arena.js"

let query = ""

let searchBar = dom(["input", {
	placeholder: 'Enter Slug or URL',
	oninput: (e) => query = e.target.value,
	onkeydown: e => e.key == "Enter" ? try_set_channel(query.trim()) : null
}])

export let focusSearchBar = () => searchBar.focus()
// slice from middle and put ... in there
let slicer = (str, size) => {
	let length = str.length
	if (length <= size) return str
	else {
		let toRemove = length - size

	}

}
let search = [".section.search", ["h4", "Channel"], searchBar,
	["button", { onclick: (e) => try_set_channel(query.trim()) }, "set"],
	['h5', 'Recently Visited'],
	memo(() => state.recentSlugs.value()
			 .map(e => ['a', {href: "#" + e}, ['button.mr', { href: '#' + e },
			e.slice(0, 18), e.length > 18 ? "..." : '']]), [state.recentSlugs])
]

let logout = ['p', ['button', {
	onclick: () => {
		localStorage.setItem("auth", "")
		state.authSlug.next("")
	}
}, 'logout']]

let authbar = memo(() =>
	state.authSlug.value() == "" ?
		["div", ["input", {
			placeholder: 'Enter Token',
			oninput: (e) => state.authKey = (e.target.value.trim()),
			onkeydown: e => {
				if (e.key == "Enter") {
					localStorage.setItem("auth", state.authKey)
					try_auth()
				}
			}
		}],

			["button", {
				onclick: () => {
					localStorage.setItem("auth", state.authKey)
					try_auth()
				}

			}, "try"],
			['a', { href: 'https://arena-token-gen.vercel.app/' }, ['p', 'Get your token here']],
		] :
		['p',
			['img.icon', { src: state.me.avatar_image.thumb }],
			["p", state.authSlug], logout]

	, [state.authSlug])

let authenticate = [".section.auth", ["h4", "Authenticate"], authbar]
let monospaceness = ['.section.monospaceness',
	['h4', 'Monospaceness'],
	['input', {
		type: 'range', oninput: e => {
			document.documentElement.style.setProperty("--monospaceness", e.target.value);
		},
		value: 65,
		min: 0,
		max: 100,
	}]]

export let sidebar = [".sidebar", { open: state.sidebarOpen }, ["h2", "Canvas"], search, authenticate, monospaceness]
