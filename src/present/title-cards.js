// Chapter title cards (docs/art/, docs/ART.md). Full-screen art shown once on
// entering a chapter; never drawn behind a room.
import ch1 from '../assets/title-cards/ch1.webp';
import ch2 from '../assets/title-cards/ch2.webp';
import ch3 from '../assets/title-cards/ch3.webp';
import ch4 from '../assets/title-cards/ch4.webp';

const load = (src) => { const img = new Image(); img.src = src; return img; };
export const TITLE_CARDS = { 1: load(ch1), 2: load(ch2), 3: load(ch3), 4: load(ch4) };
