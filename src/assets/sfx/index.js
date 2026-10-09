// Recorded sound effects: drop `<event>.ogg` (or .mp3/.wav) here and it
// replaces that event's synth placeholder. docs/SFX-PROMPTS.md lists them.
const files = import.meta.glob('./*.{ogg,mp3,wav,webm}', { eager: true, query: '?url', import: 'default' });
export const SFX_URLS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.replace(/^\.\//, '').replace(/\.\w+$/, ''), url]));
