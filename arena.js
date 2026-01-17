import {state} from './state.js'
import { notificationpopup } from './notification.js';

let host = "https://api.are.na/v2/"
let host3="https://api.are.na/v3/channels/" 

let headers = () => ({
	"Content-Type": "application/json",
	Authorization: "Bearer " + state.authKey,
})

export const update_block = async (block_id, body, slug, fuck = false) => {
	return fetch(host + `blocks/${block_id}`, {
		headers: headers(),
		method: "PUT",
		body: JSON.stringify(body),
	}).then((res) => {
		// if (fuck) { fuck_refresh(slug) }
		return res
	});
};
export const add_link = async (slug, url) => {
	console.log("adding to", slug, url)
	return fetch(host + "channels/" + slug + "/blocks", {
		headers: headers(),
		method: "POST",
		body: JSON.stringify({source: url}),
	})
		.then((response) =>{
			console.log(response)
			console.log(response.status)
			let msg = response.status == '401' ? "Unauthorized" : response.status
			if (!response.ok) notificationpopup("Couldn't Make Block: " + msg, true)
			return response.json()
	})
		.then((data) => {
			 return data
		});
};
export const add_block = async (slug, title, content) => {
	console.log("adding", title, "to", slug, content)
	return fetch(host + "channels/" + slug + "/blocks", {
		headers: headers(),
		method: "POST",
		body: JSON.stringify({content: content}),
	})
		.then((response) =>{
			console.log(response)
			console.log(response.status)
			let msg = response.status == '401' ? "Unauthorized" : response.status
			if (!response.ok) notificationpopup("Couldn't Make Block: " + msg, true)
			return response.json()
	})
		.then((data) => {
			let block_id = data.id;
			// TODO: better way to do this
			if (title !== "") return update_block(block_id, { title }, slug);
			else return data
		});
};
export const connect_block = async (slug, id, connectable_type = 'Block') => {
	return fetch(host+"channels/"+slug+"/connections", {
		headers: headers(),
		method: "POST",
		body: JSON.stringify({connectable_type, connectable_id : id})
	})
	.then((res) => res.json())
}
export const me = async () => {
	return fetch(host + `me`, {headers: headers()}).then((res) => res);
};
export const get_channel = async (slug, page = 1) => {
	return fetch(host3+ slug + `/contents?per=100&page=${page}&sort=position_desc`, { headers:headers() })
		.then(async (res) => {
			if (res.status != 200) {
				console.log(res.status)
				console.log(res)
				// notificationpopup("Failed to Get Channel: " + slug + " Status: "+res.status, true)
				return {error: "STATUS: " + res.status}
			}
			notificationpopup('Recieved Page ' + page + ' of ' + slug)
			let json = await res.json()
			if (json.meta.has_more_pages) {
				let nextPage = json.meta.next_page
				if (nextPage <= 5) await get_channel(slug, nextPage).then(res => json.data = json.data.concat(res.data))
			}

			notificationpopup('Loaded '+json.data.length+ ' blocks' )

			return json
		})
}
export let try_auth = () => {
	me()
		.then(res=>{
			if (res.status == 200) {
				res.json().then(m => {
					Object.assign(state.me, m)
					state.authSlug.next(m.slug)
					notificationpopup('Authenticated as: ' + m.slug)
				})
			}
			else {
				console.log("Auth failed: ", res.status, res)
				notificationpopup("Auth failed: " + res.status, true)
			}
		})
}


