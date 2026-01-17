import { unwrap } from "./block.js"
import { memo } from "./chowk.js"

export let svgrectnormal = (x, y, width, height, stroke = "blue", strokewidth = 4) =>{
	// TODO: Move the memo outside and send inside
	return ['rect', {
		x, y, width, height,
		stroke,
		fill: '#fff1',
		"stroke-width": strokewidth
	}]
}

export let svgrect = (x1, y1, x2, y2, stroke = "blue", width = 4) =>{
	// TODO: Move the memo outside and send inside
	return ['rect', {
		x: Math.min(unwrap(x1), unwrap(x2)) || 0,
		y:  Math.min(unwrap(y1), unwrap(y2)) || 0,
		width: Math.abs(unwrap(x2) - unwrap(x1)) || 0,
		height: Math.abs(unwrap(y2) - unwrap(y1)) || 0,
		stroke,
		fill: '#fff1',
		"stroke-width": width
	}]
}
export let svgline = (x1, y1, x2, y2, stroke = "blue", width = 2, dash = 0, opts) =>
	['line', {
		 x1, y1, x2, y2,
		stroke,
		"stroke-width": width,
		'stroke-dasharray': dash,
		...opts
	}]

export let svgx = (width, height, fill = 'blue', weight = 2) => {
	if (!height) height = width
	return ['svg', { width, height },
					...x(width, height, fill, weight),]
}

export let x = (width, height, fill = 'blue', weight) => {
	return [svgline(0, 0, width, height, fill, weight),
					svgline(width, 0, 0, height, fill, weight)]
}

let value = (v) => typeof v == 'number' ? v : v.isReactive ? v.value() : v

export let svgcurveline = (
	x1, y1,
	x2, y2,
	stroke = "blue",
	width = 4,
	curve = 40,
) => [
		'path',
		{
			d: `M ${value(x1)} ${value(y1)}
        C ${value(x1) + curve} ${value(y1)},
          ${value(x2) - curve} ${value(y2)},
          ${value(x2)} ${value(y2)}`,
			fill: 'none',
			stroke,
			'stroke-width': width
		}
	]

export let svgArrow = (side, svgWidth, svgHeight, stroke = 'blue', weight = 1.5) => {
	if (!svgHeight) svgHeight = svgWidth

	let width = svgWidth - weight
	let height = svgHeight - weight
	let midX = width / 2
	let midY = height / 2

	switch (side) {
		case 'e': // →
			return ['svg', { width, height },
				// shaft
				svgline(weight, midY, width, midY, stroke, weight),
				// head
				svgline(width - midY, weight, width, midY, stroke, weight),
				svgline(width - midY, height, width, midY, stroke, weight),
			]

		case 'w': // ←
			return ['svg', { width, height },
				svgline(width, midY, weight, midY, stroke, weight),
				svgline(midY, weight, weight, midY, stroke, weight),
				svgline(midY, height, weight, midY, stroke, weight),
			]

		case 'n': // ↑
			return ['svg', { width, height },
				svgline(midX, height, midX, weight, stroke, weight),
				svgline(weight, midX, midX, weight, stroke, weight),
				svgline(width, midX, midX, weight, stroke, weight),
			]

		case 's': // ↓
			return ['svg', { width, height },
				svgline(midX, weight, midX, height, stroke, weight),
				svgline(weight, height - midX, midX, height, stroke, weight),
				svgline(width, height - midX, midX, height, stroke, weight),
			]
	}
}
