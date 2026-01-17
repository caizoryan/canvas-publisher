import { button } from "./block.js"
import { memo, reactive } from "./chowk.js"
import { MD } from "./md.js"
import { state } from "./state.js"

	let commandSections = {
		drag: `

| CMD          |  Action                  |  
| ----------   | ---------------------- |  
| __Drag__     | (on canvas) To Pan   |
| __Drag__     | (on blocks) To move them   |
| __⇧+Drag__   |  To multiselect    |
| __⌘+Drag__   |  To make a new Block   |
| __⌘+⇧+Drag__ |  To make a new Group   |
| __⌘+Drag__   |  (on a group) To Move without children   |
| __⌘+Scroll__ |  To zoom in and out   |

`,

		navigation: `
| CMD             | Action                 |  
| --------------- | ---------------------- |  
| __⌘ + =__ | Zoom in |
| __⌘ + -__ | Zoom out|
| __B__ | Jump to location before previous jump when using block links |
| __T__ | Toggle between trackpad mode and scroll mode  |
| __WASD__      | Move around the canvas |  
| __ArrowKeys__ | Move around the canvas |
`,

		misc: `
| CMD        | Action                 |  
| ---------- | ---------------------- |  
| __⌘+E__ | Open sidebar |
| __⌘+Z__ | undo |
| __⌘+⇧+Z__ | redo|
| __⌘S__ |  Save                   |
| __⌘D__ |  Download .canvas to open in Obsidian or kinopio                   |
`


	}

let current = reactive(commandSections.drag)
export let helpbar = ['.help', {
	style: `background: var(--b${Math.floor(Math.random() * 6)});`,
	active: state.helpOpen
},
	memo(() => MD(current.value()), [current]),
	button('Drag', () => current.next(commandSections.drag)),
	button('Navigation', () => current.next(commandSections.navigation)),
	button('Misc', () => current.next(commandSections.misc)),
]
