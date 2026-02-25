import '@testing-library/jest-dom'

// Minimal Response polyfill for Jest node/jsdom environment
if (typeof global.Response === 'undefined') {
	class _Response {
		constructor(body = null, init = {}) {
			this._body = body
			this.status = init.status || 200
			this.headers = init.headers || {}
		}
		async text() {
			if (typeof this._body === 'string') return this._body
			return JSON.stringify(this._body)
		}
		async json() {
			return JSON.parse(await this.text())
		}
	}
	global.Response = _Response
}
