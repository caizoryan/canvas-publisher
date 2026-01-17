export const drag = (elem, options = {}) => {
	// Default Parameters
	const pan = options.pan !== false;
	const pan_switch = options.pan_switch ? options.pan_switch : true;	// Default: true
	const bound = (['inner', 'outer', 'none'].includes(options.bound)) ? options.bound : 'none';
	const set_left = options.set_left ? options.set_left : (left) => { elem.style.left = left + "px"; };
	const set_top = options.set_top ? options.set_top : (top) => { elem.style.top = top + "px"; };
	const set_position = options.set_position ? options.set_position : undefined
	const onstart = options.onstart ? options.onstart : () => null;
	const onend = options.onend ? options.onend : () => null;
	const targetref = options.targetref

	// For panning (translate)
	let lastPosX, lastPosY;					// Needed because of decimals 
	let posX_min, posY_min, posX_max, posY_max;
	let parentScale; 						// Needed for avoid calculate every pointermove

	// Attach event listeners
	let isValid = normalize(elem);
	if (!isValid) return;

	elem.do_move = do_move;

	if (pan) {
		// Pointer events, needed for move
		elem.addEventListener("pointerdown", handle_pointerdown);
		elem.addEventListener("pointerup", handle_pointerup);
		elem.addEventListener("pointermove", handle_pointermove);
	}

	// Checks whether element is contained according to bounds
	function normalize(elem) {
		const width = elem.offsetWidth;
		const widthp = elem.parentNode.offsetWidth;
		const height = elem.offsetHeight;
		const heightp = elem.parentNode.offsetHeight;

		if (width > widthp)
			if (bound == "inner" && (width > widthp || height > heightp)) {
				console.error("panzoom() error: In the 'inner' mode, with or height must be smaller than its container (parent)");
				return false;
			}
			else if (bound == "outer" && (width < widthp || height < heightp)) {
				console.error("panzoom() error: In the 'outer' mode, with or height must be larger than its container (parent)");
				return false;
			}
		return true;
	}

	function do_move(deltaX, deltaY) {
		lastPosX += deltaX;		// Needed because of decimals
		lastPosY += deltaY;		// Needed because of decimals

		if (bound !== 'none') {
			lastPosX = Math.min(Math.max(posX_min, lastPosX), posX_max);	// Restrict Pos X
			lastPosY = Math.min(Math.max(posY_min, lastPosY), posY_max);	// Restrict Pos Y	
		}

		if (set_position) {
			set_position(lastPosX, lastPosY)
		}

		else {
			set_left(lastPosX);
			set_top(lastPosY);
		}

	}


	function handle_pointerdown(e) {
		let target = check_target(e.target, e.currentTarget);
		if (!target) return;
		let pann = typeof pan_switch === 'function' ? pan_switch() : pan_switch;
		if (!pann) return;
		// this is so hacky, fuck google chrome
		if (target != e.target) {

			if (e.target instanceof HTMLInputElement) return
			else if (e.target instanceof HTMLButtonElement) return
			else {
				let isChromium = !!window.chrome;
				let isFirefox = navigator.userAgent.includes("Mozilla")
				let version = parseFloat(navigator.userAgent.split("/").pop())
				if (isChromium || (isFirefox && version > 138)) {
					if (e.target.click) e.target.click()
					else if (e.target.focus) {
						e.target.focus()
					}
				}
			}
		}

		e.preventDefault(); e.stopPropagation();

		onstart(e)
		target.style.cursor = 'none'

		// Set Last Element Position. Needed because event offset doesn't have decimals. And decimals will be needed when dragging
		lastPosX = target.offsetLeft;
		lastPosY = target.offsetTop;

		// Set Position Bounds
		const matrix = new WebKitCSSMatrix(getComputedStyle(e.target).getPropertyValue("transform"));
		const { a: scaleX, b: skewY, c: skewX, d: scaleY, e: translateX, f: translateY } = matrix;
		const scale = scaleX;

		// Set Position Bounds
		if (bound == 'inner') {
			posX_min = target.offsetWidth / 2 * (scale - 1) - translateX;
			posY_min = target.offsetHeight / 2 * (scale - 1) - translateY;
			posX_max = target.parentNode.offsetWidth - target.offsetWidth - target.offsetWidth / 2 * (scale - 1) - translateX;
			posY_max = target.parentNode.offsetHeight - target.offsetHeight - target.offsetHeight / 2 * (scale - 1) - translateY;
		}
		else if (bound == 'outer') {
			posX_max = target.offsetWidth / 2 * (scale - 1) - translateX;
			posY_max = target.offsetHeight / 2 * (scale - 1) - translateY;
			posX_min = target.parentNode.offsetWidth - target.offsetWidth - target.offsetWidth / 2 * (scale - 1) - translateX;
			posY_min = target.parentNode.offsetHeight - target.offsetHeight - target.offsetHeight / 2 * (scale - 1) - translateY;
		}

		const { x: px1, y: py1, width: pwidth1, height: pheight1 } = target.parentNode.getBoundingClientRect();
		const pwidth2 = target.parentNode.offsetWidth;
		parentScale = pwidth1 / pwidth2;

		target.setPointerCapture(e.pointerId);	// https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
	}

	function check_target(elem, target) {
		if (elem !== target) {
			let buffer = target
			// check parent till no parent
			while (buffer !== document.body) {
				if (buffer === target) {
					return buffer;
				}
				else buffer = buffer.parentNode
			}
			return false;
		}
		if (elem === target) return elem;
	}

	function check_target_strict(elem, target) {
		if (elem === target) return elem;
		else return false
	}

	function handle_pointermove(e) {
		let target = check_target_strict(e.target, e.currentTarget);
		if (!target) return;
		if (!target.hasPointerCapture(e.pointerId)) return;
		let pann = typeof pan_switch === 'function' ? pan_switch() : pan_switch;
		if (!pann) return;
		e.preventDefault();
		e.stopPropagation();

		const deltaX = e.movementX / parentScale;// vvpScale It's pinch default gesture zoom (Android). Ignore in Desktop
		const deltaY = e.movementY / parentScale;// vvpScale It's pinch default gesture zoom (Android). Ignore in Desktop

		do_move(deltaX, deltaY);
	}

	function handle_pointerup(e) {
		let target = check_target(e.target, e.currentTarget);
		if (!target) return;
		e.preventDefault();
		e.stopPropagation();
		onend(e)
		target.style.cursor = ''
		target.releasePointerCapture(e.pointerId);
	}


	let kill = () => {}

	return { do_move, kill };
};
