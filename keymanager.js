// TODO: COMPONENT: Alternate object reps
// (1) <-> (!)
// (2) <-> (@)
// (3) <-> ($)
// ... etc
const shift_nums = {
	"`": "~",
	"1": "!",
	"2": "@",
	"3": "#",
	"4": "$",
	"5": "%",
	"6": "^",
	"7": "&",
	"8": "*",
	"9": "(",
	"0": ")",
	"-": "_",
	"=": "+",
	";": ":",
	"'": '"',
	",": "<",
	".": ">",
	"/": "?",
	"\\": "|",
};

// TODO makes for a nice debugger window (do keystrokes in window to see if works)
export class Keystroke {
	constructor({ shift, ctrl, alt, meta, char }) {
		this.shift = shift || false;
		this.ctrl = ctrl || false;
		this.alt = alt || false;
		this.meta = meta || false;
		this.char = char || "";
	}

	compare({ shift, ctrl, alt, meta, char }) {
		return this.shift == shift &&
			this.ctrl == ctrl &&
			this.alt == alt &&
			this.meta == meta &&
			this.char == char;
	}

	compareModifier({ shift, ctrl, alt, meta }) {
		return this.shift == shift &&
			this.ctrl == ctrl &&
			this.alt == alt &&
			this.meta == meta;
	}

	toString() {
		const ctrl = this.ctrl ? "Ctrl" : "";
		const meta = this.meta ? "CMD" : "";
		const shift = this.shift ? "Shift" : "";
		const alt = this.alt ? "Alt" : "";
		const char = this.char ? this.char : "";

		return [ctrl, meta, shift, alt, char].filter((e) => e != "").join(" + ");
	}

	compareEvent(e, modifiers = true) {
		// -------------------
		// Find Which key is pressed
		// -------------------
		let code;

		if (e.keyCode) code = e.keyCode;
		let character = e.code.replace("Key", "").replace("Digit", "").toLowerCase();

		if (Object.values(shift_nums).includes(e.key) && e.shiftKey) {
			// find the the value and set it to key
			character = Object.entries(shift_nums).find(([_, value]) =>
				value == e.key
			)[0];
		}

		if (code == 188) character = ","; //If the user presses , when the type is onkeydown
		if (code == 190) character = "."; //If the user presses , when the type is onkeydown

		const keystroke_event = {
			shift: false,
			ctrl: false,
			alt: false,
			meta: false,
			char: character,
		};

		console.log(character)

		if (e.ctrlKey) keystroke_event.ctrl = true;
		if (e.shiftKey) keystroke_event.shift = true;
		if (e.altKey) keystroke_event.alt = true;
		if (e.metaKey) keystroke_event.meta = true;

		if (!modifiers){
			// make the keystroke event modifiers same as this
			keystroke_event.ctrl = this.ctrl
			keystroke_event.alt = this.alt
			keystroke_event.meta = this.meta
			keystroke_event.shift = this.shift
		}

		const matched = this.compare(keystroke_event);
		return matched;
	}
}

export class Keymanager {
	constructor() {
		this.keystrokes = [];
	}

	event(e) {
		this.keystrokes.forEach((fn) => fn(e));
	}

	parse_key(keystroke) {
		let keystroke_obj = {
			shift: false,
			ctrl: false,
			alt: false,
			meta: false,
			char: "",
		};

		let keys = keystroke.toLowerCase().split("+");

		keys.forEach((k) => {
			k = k.trim()
			//Modifiers
			if (k == "ctrl" || k == "control") {
				keystroke_obj.ctrl = true;
			} else if (k == "shift") {
				keystroke_obj.shift = true;
			} else if (k == "alt") {
				keystroke_obj.alt = true;
			} else if (k == "meta" || k == "cmd") {
				keystroke_obj.meta = true;
			} else {
				if (k == '-') k = 'minus'
				else if (k == '=') k = 'equal'
				keystroke_obj.char = k;
			}
		});

		return keystroke_obj;
	}

	create_fn(shortcut, callback, options) {
		return function check_key(e) {
			// -------------------
			// disable Input and Textarea
			// -------------------
			if (options["disable_in_input"]) {
				let element;
				if (e.target) element = e.target;
				else if (e.srcElement) element = e.srcElement;
				if (element.nodeType == 3) element = element.parentNode;
				if (element.tagName == "INPUT" || element.tagName == "TEXTAREA") return;
			}

			const matched = shortcut.compareEvent(e, options.modifiers);

			// -------------------
			// running callback
			// -------------------
			if (matched) {
				console.log("*️⃣ Matched " + shortcut.toString());
				if (!options["propagate"]) { 
					e.stopPropagation();
				}

				if (options["preventDefault"]) { 
					e.preventDefault();
				}

				callback(e);
			}
		};
	}

	on(keystroke, callback, opts) {
		//
		// -------------------
		// managing options
		// -------------------
		const default_options = {
			"type": "keydown",
			'modifiers': true,
			"propagate": false,
			"preventDefault": false,
			"disable_in_input": false,
			"keycode": false,
		};

		const options = default_options;
		if (opts) Object.assign(options, opts);

		const shortcut_str = keystroke.toLowerCase();
		const shortcut_parsed = this.parse_key(shortcut_str);
		const shortcut = new Keystroke(shortcut_parsed);

		const check_key = this.create_fn(shortcut, callback, options);

		this.keystrokes.push(check_key);
	}
}
