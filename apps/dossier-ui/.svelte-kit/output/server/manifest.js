export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CMge8aia.js",app:"_app/immutable/entry/app.Bxs7bbRS.js",imports:["_app/immutable/entry/start.CMge8aia.js","_app/immutable/chunks/Dca3cEG8.js","_app/immutable/chunks/TUqvhoEA.js","_app/immutable/chunks/CUcTEjDM.js","_app/immutable/chunks/DAlWl-TX.js","_app/immutable/entry/app.Bxs7bbRS.js","_app/immutable/chunks/TUqvhoEA.js","_app/immutable/chunks/BTksbenU.js","_app/immutable/chunks/uOhD1TE6.js","_app/immutable/chunks/BruAzle-.js","_app/immutable/chunks/DAlWl-TX.js","_app/immutable/chunks/DRtqEIUf.js","_app/immutable/chunks/q8CBg6Re.js","_app/immutable/chunks/Cp8Eapde.js","_app/immutable/chunks/VDRMNlXv.js","_app/immutable/chunks/CUcTEjDM.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/chat",
				pattern: /^\/chat\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/connections",
				pattern: /^\/connections\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/help",
				pattern: /^\/help\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/settings",
				pattern: /^\/settings\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
