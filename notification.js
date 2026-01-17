import {dom} from './dom.js'

// --------------------------
// Utility #dom #notification 
// --------------------------
export let notificationpopup = (msg, error = false) => {
	msg = error ? '🚫 ' +msg : msg
	let tag = '.notification' + (error ? '.error' : '')
	let style = `
	position: fixed;
	right: -50vw;
	opacity: 0;
	bottom: 1em;
	transition: 200ms;
`

	let d = dom(tag, {style}, msg)

	document.querySelectorAll('.notification')
		.forEach((e) => {
			let b = parseFloat(e.style.bottom)
			e.style.bottom = (b + 5) + 'em'
		})

	document.body.appendChild(d)

	setTimeout(() => { d.style.right = '1em'; d.style.opacity = 1 }, 5)
	setTimeout(() => { d.style.opacity = 0 }, error ? 6000 : 4500)
	setTimeout(() => { d.remove() }, error ? 9500 : 8000)
}
