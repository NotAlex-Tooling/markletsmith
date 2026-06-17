// SvelteKit configuration: sets the deployment adapter for the app
import adapter from '@sveltejs/adapter-auto';

const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
